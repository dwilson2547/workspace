// Pure decision logic: no Arduino, no I2C, no globals.
//
// Kept separate from sensors.cpp so it can be compiled and tested on the host --
// see test/run_host_tests.sh. This is the code where a silent mistake is most
// expensive: a mis-derived ring index aims a whole sector the wrong way, and a
// mis-classified status hands ArduPilot a distance it should have discarded.
#pragma once

#include <stdint.h>

#include "config.h"

// Raw VL53L1X RangeStatus -> meaning, per handoff spec 4.1.
//
// Takes a raw uint8_t rather than a library enum on purpose: Pololu's enum omits
// statuses 8, 11, 12 and 14 as "not used in API", so switching on enum members
// would silently drop cases the spec names. The numbers come from vl53l1_def.h
// and are stable across libraries.
Reading classifyStatus(uint8_t status);

// Ring index 0..RING_COUNT-1 derived from a slot's bearing, or 0xFF for a slot
// that is not a ring member or whose bearing is not on the increment.
uint8_t ringIndexForSlot(const SensorSlot &slot);

// True when every ring index is claimed exactly once. A map with a duplicated or
// missing bearing would silently mis-aim whole sectors.
bool ringMapIsSane(const SensorSlot *map, uint8_t count);
