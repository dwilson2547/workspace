#include "config.h"

// Placeholder geometry: a uniform 45 deg ring on mux A + one up-facing sensor on
// mux B. The channel assignments are a guess and the bearings assume sensor 0
// faces the nose. Replace wholesale from scan-mode output.
const SensorSlot SENSOR_MAP[] = {
    {MUX_A_ADDR, 0, SlotRole::Ring, 0.0f},
    {MUX_A_ADDR, 1, SlotRole::Ring, 45.0f},
    {MUX_A_ADDR, 2, SlotRole::Ring, 90.0f},
    {MUX_A_ADDR, 3, SlotRole::Ring, 135.0f},
    {MUX_A_ADDR, 4, SlotRole::Ring, 180.0f},
    {MUX_A_ADDR, 5, SlotRole::Ring, 225.0f},
    {MUX_A_ADDR, 6, SlotRole::Ring, 270.0f},
    {MUX_A_ADDR, 7, SlotRole::Ring, 315.0f},
    {MUX_B_ADDR, 0, SlotRole::Up, 0.0f},
};

const uint8_t SENSOR_COUNT = sizeof(SENSOR_MAP) / sizeof(SENSOR_MAP[0]);
