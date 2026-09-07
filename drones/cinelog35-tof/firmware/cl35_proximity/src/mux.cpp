#include "mux.h"

#include <Arduino.h>
#include <Wire.h>

#include "config.h"

namespace mux {
namespace {

constexpr uint8_t NO_MUX = 0xFF;

uint8_t g_current_mux = NO_MUX;
uint8_t g_current_channel = 0xFF;

bool writeControl(uint8_t addr, uint8_t value) {
  Wire.beginTransmission(addr);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

}  // namespace

void begin() {
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(I2C_FREQ_HZ);
  deselectAll();
}

void deselectAll() {
  // Deliberately unconditional and return-value-free: this runs on the error
  // path, where a mux may well be absent, and there is nothing useful to do
  // about a failure beyond having tried.
  writeControl(MUX_A_ADDR, 0x00);
  writeControl(MUX_B_ADDR, 0x00);
  g_current_mux = NO_MUX;
  g_current_channel = 0xFF;
}

bool select(uint8_t addr, uint8_t channel) {
  if (channel >= MUX_CHANNELS) {
    return false;
  }
  if (g_current_mux == addr && g_current_channel == channel) {
    return true;
  }
  if (g_current_mux != NO_MUX && g_current_mux != addr) {
    if (!writeControl(g_current_mux, 0x00)) {
      // Could not close the other mux, so we cannot guarantee address
      // exclusivity. Refuse rather than corrupt the next transaction.
      g_current_mux = NO_MUX;
      g_current_channel = 0xFF;
      return false;
    }
  }
  if (!writeControl(addr, static_cast<uint8_t>(1u << channel))) {
    g_current_mux = NO_MUX;
    g_current_channel = 0xFF;
    return false;
  }
  g_current_mux = addr;
  g_current_channel = channel;
  return true;
}

bool present(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void recoverBus() {
  Wire.end();

  pinMode(PIN_SCL, OUTPUT_OPEN_DRAIN);
  pinMode(PIN_SDA, INPUT_PULLUP);
  digitalWrite(PIN_SCL, HIGH);

  // Up to 9 clocks lets a slave finish whatever byte it thinks it is sending and
  // release SDA.
  for (uint8_t i = 0; i < 9 && digitalRead(PIN_SDA) == LOW; ++i) {
    digitalWrite(PIN_SCL, LOW);
    delayMicroseconds(5);
    digitalWrite(PIN_SCL, HIGH);
    delayMicroseconds(5);
  }

  // Manual STOP: SDA low->high while SCL is high.
  pinMode(PIN_SDA, OUTPUT_OPEN_DRAIN);
  digitalWrite(PIN_SDA, LOW);
  delayMicroseconds(5);
  digitalWrite(PIN_SCL, HIGH);
  delayMicroseconds(5);
  digitalWrite(PIN_SDA, HIGH);
  delayMicroseconds(5);

  begin();
}

}  // namespace mux
