#include "scan.h"

#include <Arduino.h>
#include <VL53L1X.h>
#include <Wire.h>

#include "config.h"
#include "mux.h"
#include "geometry.h"

namespace scan {
namespace {

constexpr uint8_t MAX_FOUND = 16;

struct Found {
  uint8_t mux_addr;
  uint8_t channel;
  bool ranging;
};

Found g_found[MAX_FOUND];
uint8_t g_found_count = 0;
VL53L1X g_dev[MAX_FOUND];

const char *muxLabel(uint8_t addr) { return addr == MUX_A_ADDR ? "A" : "B"; }

uint8_t sweepMux(uint8_t addr) {
  if (!mux::present(addr)) {
    Serial.printf("  mux %s (0x%02X): NO RESPONSE\n", muxLabel(addr), addr);
    return 0;
  }
  Serial.printf("  mux %s (0x%02X): present\n", muxLabel(addr), addr);

  uint8_t n = 0;
  for (uint8_t ch = 0; ch < MUX_CHANNELS; ++ch) {
    if (!mux::select(addr, ch)) {
      Serial.printf("    ch %u: mux write failed\n", ch);
      continue;
    }
    Wire.beginTransmission(0x29);
    const bool acked = (Wire.endTransmission() == 0);
    if (!acked) {
      continue;
    }
    if (g_found_count >= MAX_FOUND) {
      continue;
    }
    g_found[g_found_count] = {addr, ch, false};
    Serial.printf("    ch %u: VL53L1X at 0x29  -> slot %u\n", ch, g_found_count);
    ++g_found_count;
    ++n;
  }
  mux::deselectAll();
  return n;
}

void printSkeleton() {
  Serial.println();
  Serial.println("--- paste into src/config.cpp, then set SENSOR_MAP_CONFIGURED = true ---");
  Serial.println("const SensorSlot SENSOR_MAP[] = {");
  for (uint8_t i = 0; i < g_found_count; ++i) {
    Serial.printf("    {MUX_%s_ADDR, %u, SlotRole::Ring, ___.0f},  // slot %u\n",
                  muxLabel(g_found[i].mux_addr), g_found[i].channel, i);
  }
  Serial.println("};");
  Serial.println("--- end ---");
  Serial.println();
  Serial.println("Fill each ___ with that sensor's bearing in degrees, clockwise from the");
  Serial.println("nose (0/45/90/135/180/225/270/315), and change the up-facing sensor's row");
  Serial.println("to SlotRole::Up (its bearing is then ignored). Every ring bearing must be");
  Serial.println("used exactly once or the firmware will refuse to transmit.");
  Serial.println();
}

void startRanging() {
  for (uint8_t i = 0; i < g_found_count; ++i) {
    if (!mux::select(g_found[i].mux_addr, g_found[i].channel)) {
      continue;
    }
    g_dev[i].setTimeout(100);
    if (!g_dev[i].init()) {
      Serial.printf("slot %u: init FAILED\n", i);
      continue;
    }
    g_dev[i].setDistanceMode(VL53L1X::Long);
    g_dev[i].setMeasurementTimingBudget(TIMING_BUDGET_US);
    g_dev[i].startContinuous(INTER_MEASUREMENT_MS);
    g_found[i].ranging = true;
  }
  mux::deselectAll();
}

}  // namespace

void run() {
  Serial.println();
  Serial.println("=========== CL35 ToF SCAN MODE ===========");
  Serial.println("Walking both muxes, all 8 channels each.");
  Serial.println();

  mux::begin();
  const uint8_t a = sweepMux(MUX_A_ADDR);
  const uint8_t b = sweepMux(MUX_B_ADDR);

  Serial.println();
  Serial.printf("Found %u sensor(s): %u on mux A, %u on mux B.\n", g_found_count, a, b);

  if (g_found_count == 0) {
    Serial.println();
    Serial.println("Nothing found. If the drone is unpowered this is expected -- the");
    Serial.println("sensors sit on their own 3.3V rail and USB only feeds the ESP32.");
    Serial.println("Otherwise check the rail, the ground bond to the ESP32, and the");
    Serial.println("4.7k pull-ups to the ESP32's 3V3 (not the sensor rail).");
    Serial.println("Retrying in 3 s...");
    delay(3000);
    ESP.restart();
  }

  if (g_found_count != SENSOR_COUNT) {
    Serial.printf("NOTE: expected %u per the spec (8 ring + 1 up).\n", SENSOR_COUNT);
  }

  printSkeleton();
  startRanging();

  Serial.println("Live distances. Wave a hand at one sensor and watch which slot moves;");
  Serial.println("that tells you the bearing for that (mux, channel). Ctrl-C when done.");
  Serial.println();

  Serial.print("        ");
  for (uint8_t i = 0; i < g_found_count; ++i) {
    Serial.printf("%s:%u     ", muxLabel(g_found[i].mux_addr), g_found[i].channel);
  }
  Serial.println();

  while (true) {
    Serial.print("mm      ");
    for (uint8_t i = 0; i < g_found_count; ++i) {
      if (!g_found[i].ranging || !mux::select(g_found[i].mux_addr, g_found[i].channel)) {
        Serial.print("  ----  ");
        continue;
      }
      if (g_dev[i].dataReady()) {
        g_dev[i].read(false);
      }
      const uint8_t st = static_cast<uint8_t>(g_dev[i].ranging_data.range_status);
      if (classifyStatus(st) == Reading::Valid) {
        Serial.printf("%6u  ", g_dev[i].ranging_data.range_mm);
      } else {
        Serial.printf("%6s  ", "-");
      }
    }
    mux::deselectAll();
    Serial.println();
    delay(200);
  }
}

}  // namespace scan
