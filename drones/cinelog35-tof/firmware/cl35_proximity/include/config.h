// CL35 ToF proximity bridge -- build-time configuration.
//
// Everything here is either fixed by the wiring (see cl35_esp32_s3_zero_wiring.png)
// or by the handoff spec. The one thing that is NOT yet known is SENSOR_MAP at the
// bottom of this file -- see the comment there.
#pragma once

#include <stdint.h>

// ---------------------------------------------------------------- pins / buses

constexpr uint8_t PIN_SDA = 8;   // GP8  -> both PCA9548A
constexpr uint8_t PIN_SCL = 9;   // GP9  -> both PCA9548A
constexpr uint8_t PIN_FC_TX = 17;  // GP17 -> FC RX
constexpr uint8_t PIN_FC_RX = 18;  // GP18 <- FC TX

constexpr uint32_t I2C_FREQ_HZ = 400000;
constexpr uint32_t FC_BAUD = 115200;  // FC side: SERIAL1_BAUD = 115

// ---------------------------------------------------------------------- muxes

constexpr uint8_t MUX_A_ADDR = 0x70;
constexpr uint8_t MUX_B_ADDR = 0x71;
constexpr uint8_t MUX_CHANNELS = 8;

// -------------------------------------------------------------------- ranging
// Inter-measurement period must be >= timing budget. 50/60 ms gives ~16 Hz per
// sensor in long mode. A 15 ms budget is short-mode only and is invalid here.

constexpr uint32_t TIMING_BUDGET_US = 50000;
constexpr uint16_t INTER_MEASUREMENT_MS = 60;

// A reading older than 3x the inter-measurement period is UNKNOWN regardless of
// the last status byte that came back.
constexpr uint32_t STALE_AFTER_MS = 3UL * INTER_MEASUREMENT_MS;  // 180 ms
constexpr uint32_t RETRY_INTERVAL_MS = 1000;

// ------------------------------------------------------------------- geometry

constexpr uint8_t RING_COUNT = 8;
constexpr float RING_INCREMENT_DEG = 360.0f / RING_COUNT;  // 45.0

// Bearing of ring index 0. Leave at 0 when a sensor faces the nose; if the whole
// ring is rotated, put the bearing of index 0 here rather than skewing the map.
constexpr float RING_ANGLE_OFFSET_DEG = 0.0f;

constexpr uint16_t MIN_DISTANCE_CM = 10;   // must not be 0
constexpr uint16_t MAX_DISTANCE_CM = 400;
constexpr uint16_t CLEAR_SENTINEL_CM = MAX_DISTANCE_CM + 1;  // 401
constexpr uint16_t UNKNOWN_SENTINEL_CM = 65535;

// ------------------------------------------------------------ MAVLink identity
// The FC is sysid 1 and the MTF-01 is being moved to 200; this is the third
// distinct value. Sharing a sysid presents as intermittent dropouts, not as a
// clean failure. See ardupilot_setup.md.

constexpr uint8_t MAV_SYSID = 201;

constexpr uint32_t OBSTACLE_TX_INTERVAL_MS = 50;    // 20 Hz
constexpr uint32_t HEARTBEAT_INTERVAL_MS = 1000;    // 1 Hz

// ----------------------------------------------------------------- sensor map

// What a reading means to ArduPilot, once status and staleness are folded in.
enum class Reading : uint8_t {
  Valid,    // distance_cm is real
  Clear,    // nothing in range -- no return, or beyond max
  Unknown,  // do not trust; publish a sentinel
};

enum class SlotRole : uint8_t {
  Ring,  // horizontal, contributes one OBSTACLE_DISTANCE sector
  Up,    // upward, goes out as DISTANCE_SENSOR / PITCH_90
};

struct SensorSlot {
  uint8_t mux_addr;
  uint8_t channel;
  SlotRole role;
  float bearing_deg;  // clockwise from nose; ignored when role == Up
};

// #############################################################################
// ##  PLACEHOLDER -- NOT THE REAL WIRING.                                    ##
// ##                                                                         ##
// ##  The physical (mux, channel) -> direction map exists only in the loom.  ##
// ##  Flash this firmware as-is and it will boot straight into SCAN MODE,    ##
// ##  which walks every channel, reports what it finds, and prints a         ##
// ##  paste-ready replacement for this table. See README.md.                 ##
// ##                                                                         ##
// ##  Then set SENSOR_MAP_CONFIGURED to true.                                ##
// #############################################################################
constexpr bool SENSOR_MAP_CONFIGURED = false;

extern const SensorSlot SENSOR_MAP[];
extern const uint8_t SENSOR_COUNT;
