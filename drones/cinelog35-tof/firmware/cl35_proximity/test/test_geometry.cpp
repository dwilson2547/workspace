// Host tests for the pure decision logic. No Arduino, no hardware.
//   ./test/run_host_tests.sh
//
// These cover the two places a silent mistake is most expensive: a mis-derived
// ring index aims a whole sector the wrong way, and a mis-classified status hands
// ArduPilot a distance it should have discarded.
#include <cstdio>
#include <cstdlib>

#include "../src/geometry.h"

static int g_failures = 0;

#define CHECK(cond)                                                       \
  do {                                                                    \
    if (!(cond)) {                                                        \
      std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);       \
      ++g_failures;                                                       \
    }                                                                     \
  } while (0)

static void test_classify_valid() {
  CHECK(classifyStatus(0) == Reading::Valid);   // RANGE_VALID
  CHECK(classifyStatus(3) == Reading::Valid);   // MIN_RANGE_CLIPPED
  CHECK(classifyStatus(6) == Reading::Valid);   // NO_WRAP_CHECK_FAIL
  CHECK(classifyStatus(11) == Reading::Valid);  // MERGED_PULSE
}

static void test_classify_clear() {
  CHECK(classifyStatus(2) == Reading::Clear);  // SIGNAL_FAIL
  CHECK(classifyStatus(4) == Reading::Clear);  // OUTOFBOUNDS_FAIL
}

static void test_classify_unknown() {
  CHECK(classifyStatus(1) == Reading::Unknown);    // SIGMA_FAIL
  CHECK(classifyStatus(5) == Reading::Unknown);    // HARDWARE_FAIL
  CHECK(classifyStatus(8) == Reading::Unknown);    // PROCESSING_FAIL
  CHECK(classifyStatus(13) == Reading::Unknown);   // MIN_RANGE_FAIL, unlisted
  CHECK(classifyStatus(14) == Reading::Unknown);   // RANGE_INVALID
  CHECK(classifyStatus(255) == Reading::Unknown);  // None
}

// The whole point of the classifier. Status 7 reports SHORT off a reflective
// surface beyond range; passing it through as valid is how an avoidance system
// flies into something.
static void test_wrap_target_never_valid() {
  CHECK(classifyStatus(7) != Reading::Valid);
  CHECK(classifyStatus(7) == Reading::Unknown);
}

static void test_ring_index_from_bearing() {
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 0.0f}) == 0);
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 45.0f}) == 1);
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 180.0f}) == 4);
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 315.0f}) == 7);
  // Wraps rather than overflowing.
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 360.0f}) == 0);
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, -45.0f}) == 7);
}

static void test_up_slot_has_no_ring_index() {
  CHECK(ringIndexForSlot({0x71, 0, SlotRole::Up, 0.0f}) == 0xFF);
}

// A bearing between sectors cannot be represented in a uniform-increment array.
// Better rejected than silently rounded into a neighbour's sector.
static void test_off_increment_bearing_rejected() {
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 22.5f}) == 0xFF);
  CHECK(ringIndexForSlot({0x70, 0, SlotRole::Ring, 100.0f}) == 0xFF);
}

static void test_map_sane_accepts_full_ring() {
  const SensorSlot map[] = {
      {0x70, 0, SlotRole::Ring, 0.0f},   {0x70, 1, SlotRole::Ring, 45.0f},
      {0x70, 2, SlotRole::Ring, 90.0f},  {0x70, 3, SlotRole::Ring, 135.0f},
      {0x70, 4, SlotRole::Ring, 180.0f}, {0x70, 5, SlotRole::Ring, 225.0f},
      {0x70, 6, SlotRole::Ring, 270.0f}, {0x70, 7, SlotRole::Ring, 315.0f},
      {0x71, 0, SlotRole::Up, 0.0f},
  };
  CHECK(ringMapIsSane(map, 9));
}

static void test_map_sane_rejects_duplicate_bearing() {
  const SensorSlot map[] = {
      {0x70, 0, SlotRole::Ring, 0.0f},   {0x70, 1, SlotRole::Ring, 45.0f},
      {0x70, 2, SlotRole::Ring, 90.0f},  {0x70, 3, SlotRole::Ring, 135.0f},
      {0x70, 4, SlotRole::Ring, 180.0f}, {0x70, 5, SlotRole::Ring, 225.0f},
      {0x70, 6, SlotRole::Ring, 270.0f}, {0x70, 7, SlotRole::Ring, 270.0f},
      {0x71, 0, SlotRole::Up, 0.0f},
  };
  CHECK(!ringMapIsSane(map, 9));
}

static void test_map_sane_rejects_missing_sector() {
  const SensorSlot map[] = {
      {0x70, 0, SlotRole::Ring, 0.0f},   {0x70, 1, SlotRole::Ring, 45.0f},
      {0x70, 2, SlotRole::Ring, 90.0f},  {0x70, 3, SlotRole::Ring, 135.0f},
      {0x70, 4, SlotRole::Ring, 180.0f}, {0x70, 5, SlotRole::Ring, 225.0f},
      {0x70, 6, SlotRole::Ring, 270.0f}, {0x71, 0, SlotRole::Up, 0.0f},
  };
  CHECK(!ringMapIsSane(map, 8));
}

// The shipped placeholder must fail the check, or the "boot into scan mode"
// safety net is the only thing standing between a guessed map and live avoidance.
static void test_shipped_placeholder_is_not_marked_configured() {
  CHECK(SENSOR_MAP_CONFIGURED == false);
}

int main() {
  test_classify_valid();
  test_classify_clear();
  test_classify_unknown();
  test_wrap_target_never_valid();
  test_ring_index_from_bearing();
  test_up_slot_has_no_ring_index();
  test_off_increment_bearing_rejected();
  test_map_sane_accepts_full_ring();
  test_map_sane_rejects_duplicate_bearing();
  test_map_sane_rejects_missing_sector();
  test_shipped_placeholder_is_not_marked_configured();

  if (g_failures == 0) {
    std::printf("all host tests passed\n");
    return 0;
  }
  std::printf("%d failure(s)\n", g_failures);
  return 1;
}
