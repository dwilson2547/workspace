// Discovery, polling and range-status classification for the VL53L1X array.
//
// All sensors run continuous ranging; the mux gates I2C access only, not sensor
// operation, so there is no start/stop round-robin. One sweep harvests whatever
// happens to be ready.
#pragma once

#include <stdint.h>

#include "config.h"
#include "geometry.h"

enum class SlotState : uint8_t {
  Absent,  // no ACK at 0x29, or init failed. Retried on a slow timer.
  Online,
};

struct SensorRuntime {
  SlotState state;
  Reading reading;
  uint16_t distance_cm;
  uint32_t last_reading_ms;  // when `reading` was last refreshed from hardware
  uint32_t last_retry_ms;
  uint8_t last_status;  // raw VL53L1X RangeStatus, for diagnostics
};

namespace sensors {

// Prepares runtime state. Does not touch the bus -- the sensor rail may be down,
// which is normal whenever USB is connected with the drone unpowered.
void begin();

// One pass of the poll loop: retry absent sensors on a slow timer, harvest ready
// measurements, and age out anything stale. Never blocks.
void service(uint32_t now_ms);

const SensorRuntime &get(uint8_t index);
uint8_t onlineCount();

// Ring index for the slot at SENSOR_MAP[index]; 0xFF if it is not a ring member.
uint8_t ringIndexFor(uint8_t index);

// Whole-map check, run at boot. See geometry.h.
bool mapIsSane();

}  // namespace sensors
