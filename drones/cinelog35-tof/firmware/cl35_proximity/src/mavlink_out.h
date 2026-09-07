// MAVLink emission to the flight controller.
//
// The array splits across two messages. The 8 horizontal sensors are one
// OBSTACLE_DISTANCE boundary; the up-facing sensor has no valid bearing in a flat
// boundary and goes out as DISTANCE_SENSOR with PITCH_90, which AP_Proximity_MAV
// stores separately as _distance_upward.
#pragma once

#include <stdint.h>

namespace mavout {

void begin();

// Fixed 20 Hz, unconditional. Never skipped for bad sensors -- the badness is
// encoded in the payload. ArduPilot resets the whole boundary on every one of
// these, so each frame must carry a complete picture.
void sendObstacleDistance(uint64_t now_us);

// Sent only when the up-facing reading is trustworthy. See the .cpp for why
// silence, rather than a sentinel, is the correct signal here.
void sendUpwardDistance(uint32_t now_ms);

void sendHeartbeat();

}  // namespace mavout
