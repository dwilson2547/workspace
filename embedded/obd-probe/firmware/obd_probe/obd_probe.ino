/*
 * obd_probe: ask a car's OBD port for its VIN and a few live values, over USB serial.
 * XIAO ESP32-S3 + TJA1051 transceiver. Standalone experiment, not part of the dbc-forge dongle.
 *
 * Boots LISTEN-ONLY: it transmits nothing until you send 'x' to arm it. Requests are read-only
 * (OBD-II modes 01 and 09), sent to the functional id 0x7DF; replies come on 0x7E8..0x7EF.
 * Nothing here has been run on a vehicle yet (README.md says how to try it).
 *
 * Serial, 115200, one command per line:
 *   x  arm: reinstall the CAN driver in normal mode (can transmit and ack)
 *   d  disarm: back to listen-only
 *   s  which PIDs are supported (mode 01 and mode 09, PID 0x00)
 *   v  VIN (mode 09 PID 02)
 *   r  rpm, speed, coolant (mode 01 PIDs 0C, 0D, 05)
 *   h  help
 * Output is one JSON object per line.
 */
#include <Arduino.h>
#include "driver/twai.h"
#include "isotp.h"
#include "obd.h"

// Pins as in embedded/can-simulator: D0 = GPIO1 -> TXD, D4 = GPIO5 <- RXD through a 10k/22k divider
// (the transceiver's RXD is 5 V logic). Confirm against your wiring before powering the bus.
constexpr gpio_num_t PIN_TX = GPIO_NUM_1;
constexpr gpio_num_t PIN_RX = GPIO_NUM_5;
constexpr uint32_t REPLY_WINDOW_MS = 1000;  // how long to collect replies to one request

static bool armed = false;
static bool driverUp = false;
static isotp::Rx rx[8];  // one reassembler per ECU, indexed by response id - 0x7E8
static uint32_t otherFrames = 0;
static uint32_t framesSeen = 0;  // every frame received since boot, any id

static void hex(const uint8_t* p, uint16_t n, char* out) {
  for (uint16_t i = 0; i < n; i++) sprintf(out + 2 * i, "%02X", p[i]);
  out[2 * n] = 0;
}

static bool startDriver(twai_mode_t mode) {
  if (driverUp) { twai_stop(); twai_driver_uninstall(); driverUp = false; }
  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(PIN_TX, PIN_RX, mode);
  g.rx_queue_len = 64;
  g.tx_queue_len = 8;
  twai_timing_config_t t = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  if (twai_driver_install(&g, &t, &f) != ESP_OK) return false;
  if (twai_start() != ESP_OK) { twai_driver_uninstall(); return false; }
  driverUp = true;
  return true;
}

static bool send(uint32_t id, const uint8_t data[8]) {
  twai_message_t m = {};
  m.identifier = id;
  m.data_length_code = 8;
  memcpy(m.data, data, 8);
  return twai_transmit(&m, pdMS_TO_TICKS(50)) == ESP_OK;
}

static void status(const char* ev) {
  twai_status_info_t s;
  twai_get_status_info(&s);
  Serial.printf("{\"ev\":\"%s\",\"armed\":%s,\"state\":%d,\"tx_err\":%u,\"rx_err\":%u,\"bus_err\":%u,\"rx_missed\":%u,\"frames\":%u}\n",
                ev, armed ? "true" : "false", (int)s.state, (unsigned)s.tx_error_counter,
                (unsigned)s.rx_error_counter, (unsigned)s.bus_error_count, (unsigned)s.rx_missed_count,
                (unsigned)framesSeen);
}

static void printResponse(uint32_t ecuId, const isotp::Rx& r) {
  obd::Response p = obd::parse(r.buf, r.expected);
  char h[2 * isotp::Rx::MAX + 1];
  hex(r.buf, r.expected, h);
  Serial.printf("{\"ev\":\"resp\",\"ecu\":\"0x%X\",\"hex\":\"%s\"", (unsigned)ecuId, h);
  if (p.kind == obd::Response::Negative) {
    Serial.printf(",\"negative\":true,\"mode\":\"0x%02X\",\"nrc\":\"0x%02X\"", p.mode, p.nrc);
  } else if (p.kind == obd::Response::Positive) {
    Serial.printf(",\"mode\":\"0x%02X\",\"pid\":\"0x%02X\"", p.mode, p.pid);
    float v;
    char vin[18];
    uint8_t pids[32];
    if (obd::rpm(p, &v)) Serial.printf(",\"rpm\":%.2f", v);
    else if (obd::speedKph(p, &v)) Serial.printf(",\"speed_kph\":%.0f", v);
    else if (obd::coolantC(p, &v)) Serial.printf(",\"coolant_c\":%.0f", v);
    else if (obd::vin(p, vin)) Serial.printf(",\"vin\":\"%s\"", vin);
    else if ((p.pid & 0x1F) == 0) {
      int k = obd::supportedPids(p, pids, 32);
      Serial.print(",\"supported\":[");
      for (int i = 0; i < k; i++) Serial.printf("%s\"0x%02X\"", i ? "," : "", pids[i]);
      Serial.print("]");
    }
  }
  Serial.println("}");
}

// Send one request and collect what comes back for REPLY_WINDOW_MS, answering multi-frame
// replies with flow control. Returns the number of complete replies.
static int ask(uint8_t mode, uint8_t pid) {
  if (!armed) { Serial.println("{\"ev\":\"error\",\"msg\":\"not armed: send x first\"}"); return 0; }
  for (auto& r : rx) r.reset();
  otherFrames = 0;
  uint8_t req[8];
  obd::request(req, mode, pid);
  Serial.printf("{\"ev\":\"request\",\"mode\":\"0x%02X\",\"pid\":\"0x%02X\"}\n", mode, pid);
  if (!send(obd::REQUEST_ID, req)) { status("tx_failed"); return 0; }
  int done = 0;
  uint32_t start = millis();
  while (millis() - start < REPLY_WINDOW_MS) {
    twai_message_t m;
    if (twai_receive(&m, pdMS_TO_TICKS(20)) != ESP_OK) continue;
    framesSeen++;
    if (m.extd || m.rtr || !obd::isResponseId(m.identifier)) { otherFrames++; continue; }
    isotp::Rx& r = rx[m.identifier - obd::RESPONSE_MIN];
    switch (r.feed(m.data, m.data_length_code)) {
      case isotp::Result::NeedFlowControl: {
        uint8_t fc[8];
        isotp::flowControl(fc);
        if (!send(obd::physicalRequestId(m.identifier), fc)) status("flow_control_tx_failed");
        break;
      }
      case isotp::Result::Complete: printResponse(m.identifier, r); done++; break;
      case isotp::Result::Error:
        Serial.printf("{\"ev\":\"isotp_error\",\"ecu\":\"0x%X\"}\n", (unsigned)m.identifier);
        break;
      default: break;
    }
  }
  Serial.printf("{\"ev\":\"done\",\"replies\":%d,\"other_frames\":%u}\n", done, (unsigned)otherFrames);
  return done;
}

static void help() {
  Serial.println("{\"ev\":\"help\",\"commands\":\"x arm, d disarm, s supported pids, v vin, r rpm/speed/coolant, h help\"}");
}

void setup() {
  Serial.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 3000) delay(10);
  if (!startDriver(TWAI_MODE_LISTEN_ONLY)) { Serial.println("{\"ev\":\"error\",\"msg\":\"can driver failed\"}"); return; }
  status("ready");
  help();
}

void loop() {
  if (Serial.available()) {
    int c = Serial.read();
    switch (c) {
      case 'x':
        armed = startDriver(TWAI_MODE_NORMAL);
        status(armed ? "armed" : "arm_failed");
        break;
      case 'd':
        armed = false;
        startDriver(TWAI_MODE_LISTEN_ONLY);
        status("disarmed");
        break;
      case 's': ask(obd::MODE_CURRENT, obd::PID_SUPPORTED); ask(obd::MODE_VEHICLE, obd::PID_SUPPORTED); break;
      case 'v': ask(obd::MODE_VEHICLE, obd::PID_VIN); break;
      case 'r':
        ask(obd::MODE_CURRENT, obd::PID_RPM);
        ask(obd::MODE_CURRENT, obd::PID_SPEED);
        ask(obd::MODE_CURRENT, obd::PID_COOLANT);
        break;
      case 'h': help(); break;
      default: break;
    }
  }
  // Idle: drain frames so the queue never fills, and report the bus state every 5 s.
  twai_message_t m;
  while (driverUp && twai_receive(&m, 0) == ESP_OK) framesSeen++;
  static uint32_t last = 0;
  if (millis() - last > 5000) { last = millis(); status("stat"); }
}
