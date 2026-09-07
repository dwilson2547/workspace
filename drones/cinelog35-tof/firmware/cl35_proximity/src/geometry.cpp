#include "geometry.h"

#include <math.h>

// Status numbers from vl53l1_def.h; see handoff spec 4.1.
Reading classifyStatus(uint8_t status) {
  switch (status) {
    case 0:   // RANGE_VALID
    case 3:   // RANGE_VALID_MIN_RANGE_CLIPPED -- caller clamps to MIN_DISTANCE_CM
    case 6:   // RANGE_VALID_NO_WRAP_CHECK_FAIL
    case 11:  // RANGE_VALID_MERGED_PULSE
      return Reading::Valid;

    case 2:  // SIGNAL_FAIL      -- nothing returning enough signal
    case 4:  // OUTOFBOUNDS_FAIL -- ST: typically fires near max distance
      return Reading::Clear;

    // 1 SIGMA_FAIL, 5 HARDWARE_FAIL, 7 WRAP_TARGET_FAIL, 8 PROCESSING_FAIL,
    // 14 RANGE_INVALID, 255 None, and anything unlisted.
    //
    // 7 is the one that matters: aliasing off a highly reflective surface beyond
    // the sensor\'s range, reported SHORT -- potentially by metres. It must never
    // reach ArduPilot as a valid range.
    //
    // 13 MIN_RANGE_FAIL is not in the spec table and lands here by default. That
    // is the conservative reading: an unknown sector is ignored, an overconfident
    // one is flown into.
    default:
      return Reading::Unknown;
  }
}

uint8_t ringIndexForSlot(const SensorSlot &slot) {
  if (slot.role != SlotRole::Ring) {
    return 0xFF;
  }
  float rel = slot.bearing_deg - RING_ANGLE_OFFSET_DEG;
  while (rel < 0.0f) rel += 360.0f;
  while (rel >= 360.0f) rel -= 360.0f;

  const float steps = rel / RING_INCREMENT_DEG;
  const long nearest = lroundf(steps);
  if (fabsf(steps - static_cast<float>(nearest)) > 0.01f) {
    return 0xFF;  // not on the increment -- cannot be a sector
  }
  return static_cast<uint8_t>(nearest % RING_COUNT);
}

bool ringMapIsSane(const SensorSlot *map, uint8_t count) {
  bool claimed[RING_COUNT] = {false};
  for (uint8_t i = 0; i < count; ++i) {
    if (map[i].role != SlotRole::Ring) {
      continue;
    }
    const uint8_t idx = ringIndexForSlot(map[i]);
    if (idx >= RING_COUNT || claimed[idx]) {
      return false;
    }
    claimed[idx] = true;
  }
  for (uint8_t i = 0; i < RING_COUNT; ++i) {
    if (!claimed[i]) {
      return false;
    }
  }
  return true;
}
