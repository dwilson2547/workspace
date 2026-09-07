#include "sensors.h"

#include <Arduino.h>
#include <VL53L1X.h>
#include <math.h>

#include "geometry.h"
#include "mux.h"

namespace sensors {
namespace {

constexpr uint8_t MAX_SLOTS = 16;  // two muxes, eight channels each
constexpr uint8_t SELECT_FAILS_BEFORE_RECOVERY = 8;

VL53L1X g_dev[MAX_SLOTS];
SensorRuntime g_rt[MAX_SLOTS];
uint8_t g_consecutive_select_fails = 0;

void markAbsent(uint8_t i, uint32_t now_ms) {
  g_rt[i].state = SlotState::Absent;
  g_rt[i].reading = Reading::Unknown;
  g_rt[i].distance_cm = UNKNOWN_SENTINEL_CM;
  g_rt[i].last_retry_ms = now_ms;
  mux::deselectAll();
}

bool bringUp(uint8_t i, uint32_t now_ms) {
  const SensorSlot &slot = SENSOR_MAP[i];

  if (!mux::select(slot.mux_addr, slot.channel)) {
    g_rt[i].last_retry_ms = now_ms;
    return false;
  }

  // Probe before init: an absent sensor rail is a normal condition, not a fault,
  // and init() on a dead channel is a slow way to find that out.
  Wire.beginTransmission(0x29);
  if (Wire.endTransmission() != 0) {
    markAbsent(i, now_ms);
    return false;
  }

  g_dev[i].setTimeout(100);
  if (!g_dev[i].init()) {
    markAbsent(i, now_ms);
    return false;
  }
  g_dev[i].setDistanceMode(VL53L1X::Long);
  g_dev[i].setMeasurementTimingBudget(TIMING_BUDGET_US);
  g_dev[i].startContinuous(INTER_MEASUREMENT_MS);

  g_rt[i].state = SlotState::Online;
  g_rt[i].reading = Reading::Unknown;
  g_rt[i].distance_cm = UNKNOWN_SENTINEL_CM;
  g_rt[i].last_reading_ms = now_ms;
  g_rt[i].last_retry_ms = now_ms;
  return true;
}

void harvest(uint8_t i, uint32_t now_ms) {
  const SensorSlot &slot = SENSOR_MAP[i];

  if (!mux::select(slot.mux_addr, slot.channel)) {
    if (++g_consecutive_select_fails >= SELECT_FAILS_BEFORE_RECOVERY) {
      g_consecutive_select_fails = 0;
      mux::recoverBus();
    }
    markAbsent(i, now_ms);
    return;
  }
  g_consecutive_select_fails = 0;

  if (!g_dev[i].dataReady()) {
    return;  // not our turn yet -- do not block
  }

  g_dev[i].read(false);
  if (g_dev[i].timeoutOccurred()) {
    markAbsent(i, now_ms);
    return;
  }

  const uint8_t status = static_cast<uint8_t>(g_dev[i].ranging_data.range_status);
  const Reading reading = classifyStatus(status);

  g_rt[i].last_status = status;
  g_rt[i].reading = reading;
  g_rt[i].last_reading_ms = now_ms;

  if (reading == Reading::Valid) {
    uint32_t cm = g_dev[i].ranging_data.range_mm / 10u;
    if (cm < MIN_DISTANCE_CM) {
      cm = MIN_DISTANCE_CM;  // includes the deliberate RangeValidMinRangeClipped clamp
    } else if (cm > MAX_DISTANCE_CM) {
      cm = MAX_DISTANCE_CM;
    }
    g_rt[i].distance_cm = static_cast<uint16_t>(cm);
  } else {
    g_rt[i].distance_cm = UNKNOWN_SENTINEL_CM;
  }
}

}  // namespace

void begin() {
  for (uint8_t i = 0; i < SENSOR_COUNT && i < MAX_SLOTS; ++i) {
    g_rt[i].state = SlotState::Absent;
    g_rt[i].reading = Reading::Unknown;
    g_rt[i].distance_cm = UNKNOWN_SENTINEL_CM;
    g_rt[i].last_reading_ms = 0;
    // Stagger nothing: first discovery attempt should happen immediately.
    g_rt[i].last_retry_ms = 0 - RETRY_INTERVAL_MS;
    g_rt[i].last_status = static_cast<uint8_t>(VL53L1X::None);
  }
}

void service(uint32_t now_ms) {
  for (uint8_t i = 0; i < SENSOR_COUNT && i < MAX_SLOTS; ++i) {
    if (g_rt[i].state == SlotState::Absent) {
      if (now_ms - g_rt[i].last_retry_ms >= RETRY_INTERVAL_MS) {
        bringUp(i, now_ms);
      }
      continue;
    }

    harvest(i, now_ms);

    if (g_rt[i].state != SlotState::Online) {
      continue;
    }

    const uint32_t age = now_ms - g_rt[i].last_reading_ms;
    if (age > STALE_AFTER_MS) {
      // Whatever it last said, it is too old to act on.
      g_rt[i].reading = Reading::Unknown;
      g_rt[i].distance_cm = UNKNOWN_SENTINEL_CM;
    }
    if (age > RETRY_INTERVAL_MS) {
      // Persistently silent though it still ACKs -- push it back through init.
      markAbsent(i, now_ms);
    }
  }
  mux::deselectAll();
}

const SensorRuntime &get(uint8_t index) { return g_rt[index]; }

uint8_t onlineCount() {
  uint8_t n = 0;
  for (uint8_t i = 0; i < SENSOR_COUNT && i < MAX_SLOTS; ++i) {
    if (g_rt[i].state == SlotState::Online) {
      ++n;
    }
  }
  return n;
}

uint8_t ringIndexFor(uint8_t index) {
  return ringIndexForSlot(SENSOR_MAP[index]);
}

bool mapIsSane() { return ringMapIsSane(SENSOR_MAP, SENSOR_COUNT); }

}  // namespace sensors
