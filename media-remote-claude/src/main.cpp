#include <Arduino.h>
#include <BleKeyboard.h>

namespace {
constexpr uint8_t ROW_COUNT = 3;
constexpr uint8_t COL_COUNT = 3;
constexpr uint8_t KEY_COUNT = ROW_COUNT * COL_COUNT;
constexpr uint16_t DEBOUNCE_MS = 20;
constexpr uint16_t ADVERTISING_BLINK_MS = 500;
constexpr uint16_t KEYPRESS_FLASH_MS = 80;

// Update these pins to match your board + keypad wiring.
constexpr uint8_t ROW_PINS[ROW_COUNT] = {4, 5, 6};
constexpr uint8_t COL_PINS[COL_COUNT] = {7, 8, 9};
constexpr uint8_t STATUS_LED_PIN = 3;
constexpr uint8_t BACKLIGHT_PIN = 10;

constexpr uint8_t BACKLIGHT_TOGGLE_KEY = 7;
constexpr uint8_t UNASSIGNED_KEY = 8;

struct KeyState {
  bool rawPressed = false;
  bool stablePressed = false;
  uint32_t lastChangeMs = 0;
};

BleKeyboard bleKeyboard("ESP32 Media Remote", "dwilson2547", 100);
KeyState keyStates[KEY_COUNT];

bool backlightOn = false;
bool advertisingLedOn = false;
uint32_t lastAdvertisingBlinkMs = 0;
uint32_t keypressFlashUntilMs = 0;

void setBacklight(bool on) {
  backlightOn = on;
  digitalWrite(BACKLIGHT_PIN, backlightOn ? HIGH : LOW);
}

void sendMediaKey(const MediaKeyReport keycode) {
  if (!bleKeyboard.isConnected()) {
    return;
  }
  bleKeyboard.write(keycode);
}

void onKeyPressed(uint8_t keyIndex) {
  keypressFlashUntilMs = millis() + KEYPRESS_FLASH_MS;

  switch (keyIndex) {
    case 0:
      sendMediaKey(KEY_MEDIA_PLAY_PAUSE);
      break;
    case 1:
      sendMediaKey(KEY_MEDIA_NEXT_TRACK);
      break;
    case 2:
      sendMediaKey(KEY_MEDIA_PREVIOUS_TRACK);
      break;
    case 3:
      sendMediaKey(KEY_MEDIA_VOLUME_UP);
      break;
    case 4:
      sendMediaKey(KEY_MEDIA_VOLUME_DOWN);
      break;
    case 5:
      sendMediaKey(KEY_MEDIA_MUTE);
      break;
    case 6:
      sendMediaKey(KEY_MEDIA_STOP);
      break;
    case BACKLIGHT_TOGGLE_KEY:
      setBacklight(!backlightOn);
      break;
    case UNASSIGNED_KEY:
    default:
      break;
  }
}

void refreshStatusLed(uint32_t nowMs) {
  if (nowMs < keypressFlashUntilMs) {
    digitalWrite(STATUS_LED_PIN, LOW);
    return;
  }

  if (bleKeyboard.isConnected()) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    return;
  }

  if ((nowMs - lastAdvertisingBlinkMs) >= ADVERTISING_BLINK_MS) {
    lastAdvertisingBlinkMs = nowMs;
    advertisingLedOn = !advertisingLedOn;
    digitalWrite(STATUS_LED_PIN, advertisingLedOn ? HIGH : LOW);
  }
}

void scanKeys(uint32_t nowMs) {
  for (uint8_t row = 0; row < ROW_COUNT; row++) {
    digitalWrite(ROW_PINS[row], LOW);
    delayMicroseconds(5);

    for (uint8_t col = 0; col < COL_COUNT; col++) {
      const uint8_t keyIndex = static_cast<uint8_t>(row * COL_COUNT + col);
      const bool pressed = (digitalRead(COL_PINS[col]) == LOW);
      KeyState &state = keyStates[keyIndex];

      if (pressed != state.rawPressed) {
        state.rawPressed = pressed;
        state.lastChangeMs = nowMs;
      }

      if ((nowMs - state.lastChangeMs) < DEBOUNCE_MS) {
        continue;
      }

      if (state.stablePressed == state.rawPressed) {
        continue;
      }

      state.stablePressed = state.rawPressed;
      if (state.stablePressed) {
        onKeyPressed(keyIndex);
      }
    }

    digitalWrite(ROW_PINS[row], HIGH);
  }
}
}  // namespace

void setup() {
  for (uint8_t i = 0; i < ROW_COUNT; i++) {
    pinMode(ROW_PINS[i], OUTPUT);
    digitalWrite(ROW_PINS[i], HIGH);
  }

  for (uint8_t i = 0; i < COL_COUNT; i++) {
    pinMode(COL_PINS[i], INPUT_PULLUP);
  }

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(BACKLIGHT_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  setBacklight(false);

  bleKeyboard.begin();
}

void loop() {
  const uint32_t nowMs = millis();
  scanKeys(nowMs);
  refreshStatusLed(nowMs);
  delay(2);
}
