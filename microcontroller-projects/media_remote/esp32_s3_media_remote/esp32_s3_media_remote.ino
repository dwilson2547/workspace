#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEHIDDevice.h>
#include "esp_system.h"

// NOTE: This sketch uses the NimBLE-Arduino library (NimBLEDevice / NimBLEHIDDevice),
// NOT the core's bundled "BLE" (BLEDevice.h) library. The bundled wrapper silently
// drops characteristics that share a UUID when built against the NimBLE backend
// (which this core is), and a composite keyboard+consumer HID device needs multiple
// report characteristics that all use UUID 0x2a4d. NimBLE-Arduino handles them
// correctly. If building in the Arduino IDE, install "NimBLE-Arduino" from the
// Library Manager.

// ---- DIAGNOSTIC INSTRUMENTATION ----
// Set to 1 to enable serial logging (reset reason, BLE state, button events) for
// troubleshooting. Keep at 0 for normal use: when running on battery with no USB
// host attached, the Serial.flush() calls below can block and make buttons laggy.
#define DIAG 0
#if DIAG
#define DLOG(...)            \
  do {                       \
    Serial.printf(__VA_ARGS__); \
    Serial.flush();          \
  } while (0)
#else
#define DLOG(...) \
  do {            \
  } while (0)
#endif

static const char *resetReasonStr(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON: return "POWERON (normal power-up)";
    case ESP_RST_EXT: return "EXT (external reset pin)";
    case ESP_RST_SW: return "SW (esp_restart)";
    case ESP_RST_PANIC: return "PANIC (exception/abort -> CRASH)";
    case ESP_RST_INT_WDT: return "INT_WDT (interrupt watchdog)";
    case ESP_RST_TASK_WDT: return "TASK_WDT (task watchdog)";
    case ESP_RST_WDT: return "WDT (other watchdog)";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
    case ESP_RST_BROWNOUT: return "BROWNOUT (voltage dip -> POWER issue)";
    case ESP_RST_SDIO: return "SDIO";
    default: return "UNKNOWN";
  }
}
// ---------------------------------------------------------------------------

namespace {

constexpr uint8_t LED_PIN = LED_BUILTIN;
constexpr uint32_t DEBOUNCE_MS = 25;
constexpr uint32_t LED_BLINK_MS = 500;
// How long a HID key/usage is held "down" before sending the release. Long enough to
// span a BLE connection event so the host sees a distinct press, short enough to feel
// instant.
constexpr uint32_t KEY_HOLD_MS = 60;

// XIAO ESP32-S3: wire each button from pin -> momentary switch -> GND.
// All buttons use INPUT_PULLUP, so LOW = pressed.
constexpr uint8_t PIN_PLAY_PAUSE = D1;
constexpr uint8_t PIN_STOP = D2;
constexpr uint8_t PIN_NEXT = D3;
constexpr uint8_t PIN_PREVIOUS = D4;
constexpr uint8_t PIN_VOL_UP = D5;
constexpr uint8_t PIN_VOL_DOWN = D8;
constexpr uint8_t PIN_MUTE = D9;
constexpr uint8_t PIN_MIC_MUTE = D10;
constexpr uint8_t PIN_UNPAIR_HOLD = D6;

// HID Consumer Page usages.
constexpr uint16_t USAGE_SCAN_NEXT = 0x00B5;
constexpr uint16_t USAGE_SCAN_PREVIOUS = 0x00B6;
constexpr uint16_t USAGE_STOP = 0x00B7;
constexpr uint16_t USAGE_PLAY_PAUSE = 0x00CD;
constexpr uint16_t USAGE_MUTE = 0x00E2;
constexpr uint16_t USAGE_VOLUME_INCREMENT = 0x00E9;
constexpr uint16_t USAGE_VOLUME_DECREMENT = 0x00EA;

// BLE keyboard report modifier bits.
constexpr uint8_t MOD_LEFT_ALT = 0x04;
constexpr uint8_t MOD_LEFT_GUI = 0x08;
constexpr uint8_t HID_KEY_K = 0x0E;

constexpr uint8_t REPORT_ID_KEYBOARD = 1;
constexpr uint8_t REPORT_ID_CONSUMER = 2;

enum class ActionType : uint8_t {
  MediaUsage,
  MicMuteShortcut,
  UnpairHold,  // hold to clear all bonds and restart (re-enter pairing)
};

// How long PIN_UNPAIR_HOLD must be held to wipe bonds.
constexpr uint32_t UNPAIR_HOLD_MS = 3000;

struct ButtonConfig {
  uint8_t pin;
  ActionType actionType;
  uint16_t usage;
};

struct ButtonState {
  bool stablePressed = false;
  bool lastRawPressed = false;
  bool holdTriggered = false;
  uint32_t lastRawChangeMs = 0;
  uint32_t pressedAtMs = 0;
};

const ButtonConfig BUTTONS[] = {
  {PIN_PLAY_PAUSE, ActionType::MediaUsage, USAGE_PLAY_PAUSE},
  {PIN_STOP, ActionType::MediaUsage, USAGE_STOP},
  {PIN_NEXT, ActionType::MediaUsage, USAGE_SCAN_NEXT},
  {PIN_PREVIOUS, ActionType::MediaUsage, USAGE_SCAN_PREVIOUS},
  {PIN_VOL_UP, ActionType::MediaUsage, USAGE_VOLUME_INCREMENT},
  {PIN_VOL_DOWN, ActionType::MediaUsage, USAGE_VOLUME_DECREMENT},
  {PIN_MUTE, ActionType::MediaUsage, USAGE_MUTE},
  {PIN_MIC_MUTE, ActionType::MicMuteShortcut, 0},
  {PIN_UNPAIR_HOLD, ActionType::UnpairHold, 0},
};

const char *const BUTTON_NAMES[] = {
  "PLAY_PAUSE", "STOP", "NEXT", "PREVIOUS", "VOL_UP",
  "VOL_DOWN", "MUTE", "MIC_MUTE", "UNPAIR_HOLD",
};

ButtonState buttonStates[sizeof(BUTTONS) / sizeof(BUTTONS[0])];

// Report 1: Keyboard (8-byte input report).
// Report 2: Consumer Control (16-bit usage code).
const uint8_t HID_REPORT_MAP[] = {
  0x05, 0x01,        // Usage Page (Generic Desktop)
  0x09, 0x06,        // Usage (Keyboard)
  0xA1, 0x01,        // Collection (Application)
  0x85, 0x01,        //   Report ID (1)
  0x05, 0x07,        //   Usage Page (Keyboard/Keypad)
  0x19, 0xE0,        //   Usage Minimum (Keyboard LeftControl)
  0x29, 0xE7,        //   Usage Maximum (Keyboard Right GUI)
  0x15, 0x00,        //   Logical Minimum (0)
  0x25, 0x01,        //   Logical Maximum (1)
  0x75, 0x01,        //   Report Size (1)
  0x95, 0x08,        //   Report Count (8)
  0x81, 0x02,        //   Input (Data,Var,Abs)
  0x95, 0x01,        //   Report Count (1)
  0x75, 0x08,        //   Report Size (8)
  0x81, 0x01,        //   Input (Const,Array,Abs)
  0x95, 0x05,        //   Report Count (5)
  0x75, 0x01,        //   Report Size (1)
  0x05, 0x08,        //   Usage Page (LEDs)
  0x19, 0x01,        //   Usage Minimum (Num Lock)
  0x29, 0x05,        //   Usage Maximum (Kana)
  0x91, 0x02,        //   Output (Data,Var,Abs)
  0x95, 0x01,        //   Report Count (1)
  0x75, 0x03,        //   Report Size (3)
  0x91, 0x01,        //   Output (Const,Array,Abs)
  0x95, 0x06,        //   Report Count (6)
  0x75, 0x08,        //   Report Size (8)
  0x15, 0x00,        //   Logical Minimum (0)
  0x25, 0x65,        //   Logical Maximum (101)
  0x05, 0x07,        //   Usage Page (Keyboard/Keypad)
  0x19, 0x00,        //   Usage Minimum (Reserved)
  0x29, 0x65,        //   Usage Maximum (Keyboard Application)
  0x81, 0x00,        //   Input (Data,Array,Abs)
  0xC0,              // End Collection
  0x05, 0x0C,        // Usage Page (Consumer)
  0x09, 0x01,        // Usage (Consumer Control)
  0xA1, 0x01,        // Collection (Application)
  0x85, 0x02,        //   Report ID (2)
  0x15, 0x00,        //   Logical Minimum (0)
  0x26, 0xFF, 0x03,  //   Logical Maximum (1023)
  0x19, 0x00,        //   Usage Minimum (0)
  0x2A, 0xFF, 0x03,  //   Usage Maximum (1023)
  0x75, 0x10,        //   Report Size (16)
  0x95, 0x01,        //   Report Count (1)
  0x81, 0x00,        //   Input (Data,Array,Abs)
  0xC0               // End Collection
};

struct KeyboardInputReport {
  uint8_t modifiers;
  uint8_t reserved;
  uint8_t keys[6];
} __attribute__((packed));

NimBLEServer *bleServer = nullptr;
NimBLEHIDDevice *bleHid = nullptr;
NimBLECharacteristic *bleKeyboardInput = nullptr;
NimBLECharacteristic *bleConsumerInput = nullptr;
bool bleConnected = false;

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo) override {
    (void)pServer;
    bleConnected = true;
    DLOG("[BLE] connected: encrypted=%d bonded=%d auth=%d\n",
         (int)connInfo.isEncrypted(), (int)connInfo.isBonded(),
         (int)connInfo.isAuthenticated());
  }

  void onDisconnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo, int reason) override {
    (void)pServer;
    (void)connInfo;
    bleConnected = false;
    DLOG("[BLE] disconnected (reason=%d), re-advertising\n", reason);
    NimBLEDevice::startAdvertising();
  }
};

// Records host subscribe events (CCCD writes) into volatile slots that the main loop
// prints, to avoid Serial output races between the BLE task and the loop task.
// subValue: 0=unsubscribed, 1=notifications, 2=indications.
volatile int16_t g_kbdSub = -1;       // -1 = no pending change to report
volatile int16_t g_consumerSub = -1;
volatile int16_t g_otherSub = -1;

class ReportSubscribeCallbacks : public NimBLECharacteristicCallbacks {
  void onSubscribe(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo &connInfo,
                   uint16_t subValue) override {
    (void)connInfo;
    if (pCharacteristic == bleKeyboardInput) {
      g_kbdSub = (int16_t)subValue;
    } else if (pCharacteristic == bleConsumerInput) {
      g_consumerSub = (int16_t)subValue;
    } else {
      g_otherSub = (int16_t)subValue;
    }
  }
};

ReportSubscribeCallbacks reportSubscribeCallbacks;

void sendBleKeyboardReport(uint8_t modifiers, uint8_t keycode) {
  if (!bleConnected || bleKeyboardInput == nullptr) {
    return;
  }

  KeyboardInputReport report = {};
  report.modifiers = modifiers;
  report.keys[0] = keycode;
  bleKeyboardInput->setValue(reinterpret_cast<uint8_t *>(&report), sizeof(report));
  bleKeyboardInput->notify();

  // Hold briefly so the key-down lands in its own BLE connection event before the
  // key-up; otherwise some hosts coalesce press+release and register nothing.
  delay(KEY_HOLD_MS);

  KeyboardInputReport releaseReport = {};
  bleKeyboardInput->setValue(reinterpret_cast<uint8_t *>(&releaseReport), sizeof(releaseReport));
  bleKeyboardInput->notify();
}

void sendBleConsumerUsage(uint16_t usage) {
  if (!bleConnected || bleConsumerInput == nullptr) {
    return;
  }

  uint8_t payload[2] = {
    static_cast<uint8_t>(usage & 0xFF),
    static_cast<uint8_t>((usage >> 8) & 0xFF),
  };
  bleConsumerInput->setValue(payload, sizeof(payload));
  bleConsumerInput->notify();

  // Hold briefly so the press lands in its own BLE connection event before release.
  delay(KEY_HOLD_MS);

  const uint8_t releasePayload[2] = {0x00, 0x00};
  bleConsumerInput->setValue(releasePayload, sizeof(releasePayload));
  bleConsumerInput->notify();
}

void triggerMicMuteAction() {
  sendBleKeyboardReport(MOD_LEFT_GUI | MOD_LEFT_ALT, HID_KEY_K);
}

void triggerMediaAction(uint16_t usage) {
  sendBleConsumerUsage(usage);
}

// Clears all stored bonds and restarts so the device comes back up advertising and
// ready for a fresh pairing. Triggered by holding PIN_UNPAIR_HOLD.
void triggerUnpair() {
  DLOG("[BLE] UNPAIR: clearing all bonds and restarting\n");
  NimBLEDevice::deleteAllBonds();
  delay(100);
  ESP.restart();
}

void onButtonPressed(size_t index) {
  const ButtonConfig &cfg = BUTTONS[index];
  DLOG("[BTN] idx=%u pin=%u name=%s connected=%d heapBefore=%u\n",
       (unsigned)index, (unsigned)cfg.pin, BUTTON_NAMES[index],
       (int)bleConnected, (unsigned)ESP.getFreeHeap());

  if (cfg.actionType == ActionType::MediaUsage) {
    triggerMediaAction(cfg.usage);
  } else if (cfg.actionType == ActionType::MicMuteShortcut) {
    triggerMicMuteAction();
  }

  DLOG("[BTN] idx=%u send returned OK heapAfter=%u\n",
       (unsigned)index, (unsigned)ESP.getFreeHeap());
}

void initButtons() {
  for (size_t i = 0; i < (sizeof(BUTTONS) / sizeof(BUTTONS[0])); ++i) {
    pinMode(BUTTONS[i].pin, INPUT_PULLUP);
    const bool pressed = digitalRead(BUTTONS[i].pin) == LOW;
    buttonStates[i].stablePressed = pressed;
    buttonStates[i].lastRawPressed = pressed;
    buttonStates[i].lastRawChangeMs = millis();
    buttonStates[i].pressedAtMs = pressed ? millis() : 0;
    buttonStates[i].holdTriggered = false;
  }
}

void updateButtons() {
  const uint32_t now = millis();
  for (size_t i = 0; i < (sizeof(BUTTONS) / sizeof(BUTTONS[0])); ++i) {
    const bool rawPressed = digitalRead(BUTTONS[i].pin) == LOW;
    ButtonState &state = buttonStates[i];

    if (rawPressed != state.lastRawPressed) {
      state.lastRawPressed = rawPressed;
      state.lastRawChangeMs = now;
    }

    if ((now - state.lastRawChangeMs) < DEBOUNCE_MS) {
      continue;
    }

    if (rawPressed != state.stablePressed) {
      state.stablePressed = rawPressed;
      if (state.stablePressed) {
        state.pressedAtMs = now;
        state.holdTriggered = false;
        onButtonPressed(i);
      } else {
        state.holdTriggered = false;
      }
    }

    // Hold-to-unpair: fire once when the button has been held long enough.
    if (state.stablePressed && !state.holdTriggered &&
        BUTTONS[i].actionType == ActionType::UnpairHold &&
        (now - state.pressedAtMs) >= UNPAIR_HOLD_MS) {
      state.holdTriggered = true;
      triggerUnpair();  // wipes bonds and restarts; does not return
    }
  }
}

void updateStatusLed() {
  if (bleConnected) {
    digitalWrite(LED_PIN, HIGH);
    return;
  }

  const bool ledOn = ((millis() / LED_BLINK_MS) % 2U) == 0U;
  digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
}

// HID keyboard appearance value (Generic Desktop / Keyboard).
constexpr uint16_t APPEARANCE_HID_KEYBOARD = 0x03C1;

void initBleHid() {
  NimBLEDevice::init("XIAO-S3-Media-Remote");

  DLOG("[BLE] stored bonds: %d (hold the UNPAIR button to clear)\n",
       NimBLEDevice::getNumBonds());

  // "Just Works" bonding: bonding=true, MITM=false, Secure Connections=true,
  // with no input/output capability (no PIN entry on the remote).
  NimBLEDevice::setSecurityAuth(true, false, true);
  NimBLEDevice::setSecurityIOCap(BLE_HS_IO_NO_INPUT_OUTPUT);

  bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  bleServer->advertiseOnDisconnect(true);

  bleHid = new NimBLEHIDDevice(bleServer);
  bleHid->setManufacturer("robo-services");
  bleHid->setPnp(0x02, 0x303A, 0x4010, 0x0100);
  bleHid->setHidInfo(0x00, 0x01);
  bleHid->setReportMap(const_cast<uint8_t *>(HID_REPORT_MAP), sizeof(HID_REPORT_MAP));

  // getInputReport()/getOutputReport() create one characteristic per report ID
  // (located by report id + type, not by UUID), so the keyboard (id 1) and
  // consumer (id 2) reports each get their own 0x2a4d characteristic.
  bleKeyboardInput = bleHid->getInputReport(REPORT_ID_KEYBOARD);
  bleHid->getOutputReport(REPORT_ID_KEYBOARD);
  bleConsumerInput = bleHid->getInputReport(REPORT_ID_CONSUMER);
  bleKeyboardInput->setCallbacks(&reportSubscribeCallbacks);
  bleConsumerInput->setCallbacks(&reportSubscribeCallbacks);

  // setBatteryLevel() defaults to notify=false, so it is safe to call before the
  // server has started (no premature notify).
  bleHid->setBatteryLevel(100);

  // Starting the server starts all registered services (the deprecated
  // hid->startServices() is now handled here).
  bleServer->start();

  DLOG("[DIAG] kbdInput=%p consumerIn=%p (both non-null => both reports registered)\n",
       (void *)bleKeyboardInput, (void *)bleConsumerInput);

  NimBLEAdvertising *advertising = NimBLEDevice::getAdvertising();
  advertising->setAppearance(APPEARANCE_HID_KEYBOARD);
  advertising->addServiceUUID(bleHid->getHidService()->getUUID());
  advertising->enableScanResponse(true);
  NimBLEDevice::startAdvertising();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(400);  // let native USB-CDC re-enumerate after a reset
  DLOG("\n\n========== BOOT ==========\n");
  DLOG("[RESET REASON] %s\n", resetReasonStr(esp_reset_reason()));
  DLOG("[HEAP] free=%u largest=%u\n",
       (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  initButtons();
  DLOG("[INIT] buttons ready, starting BLE...\n");
  initBleHid();
  DLOG("[INIT] BLE advertising as XIAO-S3-Media-Remote\n");
}

void loop() {
  updateButtons();
  updateStatusLed();

#if DIAG
  // Drain host subscribe events recorded by the BLE task (printed here to avoid
  // cross-task Serial races).
  if (g_kbdSub >= 0) {
    Serial.printf("[BLE] KEYBOARD report notifications %s (subValue=%d)\n",
                  g_kbdSub ? "ENABLED" : "disabled", (int)g_kbdSub);
    Serial.flush();
    g_kbdSub = -1;
  }
  if (g_consumerSub >= 0) {
    Serial.printf("[BLE] CONSUMER report notifications %s (subValue=%d)\n",
                  g_consumerSub ? "ENABLED" : "disabled", (int)g_consumerSub);
    Serial.flush();
    g_consumerSub = -1;
  }
  if (g_otherSub >= 0) {
    Serial.printf("[BLE] OTHER report notifications %s (subValue=%d)\n",
                  g_otherSub ? "ENABLED" : "disabled", (int)g_otherSub);
    Serial.flush();
    g_otherSub = -1;
  }

  // Poll the live link security state and log changes, so we can see whether the
  // link actually encrypts/bonds after pairing (onConnect fires too early to see it).
  {
    static uint32_t lastPollMs = 0;
    static int8_t lastState = -1;  // -1 unknown, else (enc<<1)|bonded
    const uint32_t now = millis();
    if ((now - lastPollMs) >= 500) {
      lastPollMs = now;
      if (bleConnected && bleServer != nullptr && bleServer->getConnectedCount() > 0) {
        NimBLEConnInfo info = bleServer->getPeerInfo(0);
        const int8_t state =
          (int8_t)((info.isEncrypted() ? 2 : 0) | (info.isBonded() ? 1 : 0));
        if (state != lastState) {
          lastState = state;
          Serial.printf("[BLE] link security now: encrypted=%d bonded=%d auth=%d\n",
                        (int)info.isEncrypted(), (int)info.isBonded(),
                        (int)info.isAuthenticated());
          Serial.flush();
        }
      } else {
        lastState = -1;
      }
    }
  }
#endif

  delay(5);
}
