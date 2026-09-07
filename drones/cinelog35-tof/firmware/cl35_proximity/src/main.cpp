// CL35 ToF -> ArduPilot proximity bridge.
//
// 9x VL53L1X (8 horizontal ring + 1 up-facing) behind two PCA9548A muxes, all at
// address 0x29, published to a MicoAir743v2 as OBSTACLE_DISTANCE + DISTANCE_SENSOR.
//
// Spec: ../../CL35 tof proximity handoff.md
#include <Arduino.h>

#include "config.h"
#include "mavlink_out.h"
#include "mux.h"
#include "scan.h"
#include "sensors.h"

namespace {

uint32_t g_next_obstacle_ms = 0;
uint32_t g_next_heartbeat_ms = 0;

}  // namespace

void setup() {
  Serial.begin(115200);

  // Do not wait for the USB CDC host. In flight there is never one, and blocking
  // here would mean the FC gets nothing until a laptop is plugged in.
  const uint32_t cdc_deadline = millis() + 1500;
  while (!Serial && millis() < cdc_deadline) {
    delay(10);
  }

  Serial.println();
  Serial.println("CL35 ToF proximity bridge");

  if (!SENSOR_MAP_CONFIGURED) {
    Serial.println("SENSOR_MAP is still the placeholder -- entering scan mode.");
    scan::run();  // never returns
  }

  if (!sensors::mapIsSane()) {
    // Refusing here is deliberate. A map with a duplicated or missing bearing
    // mis-aims whole sectors, and a mis-aimed proximity ring is worse than none:
    // avoidance would push the craft toward the obstacle it thinks it is dodging.
    Serial.println("FATAL: SENSOR_MAP does not cover each of the 8 ring bearings");
    Serial.println("exactly once. Fix src/config.cpp -- refusing to transmit.");
    while (true) {
      delay(1000);
    }
  }

  mux::begin();
  sensors::begin();
  mavout::begin();

  Serial.printf("Ring %u sectors at %.1f deg, %u slots mapped. Transmitting at %u Hz.\n",
                RING_COUNT, RING_INCREMENT_DEG, SENSOR_COUNT,
                static_cast<unsigned>(1000u / OBSTACLE_TX_INTERVAL_MS));
}

void loop() {
  const uint32_t now_ms = millis();

  // Sweep as fast as the loop allows. One pass is ~9 short transactions, far
  // above the per-sensor measurement rate -- each sensor updates on its own
  // cadence and this just harvests whatever is ready.
  sensors::service(now_ms);

  // Fixed cadence, independent of sensor health. The only legitimate reason to
  // stop transmitting is total pipeline death, and that happens for free.
  if (static_cast<int32_t>(now_ms - g_next_obstacle_ms) >= 0) {
    g_next_obstacle_ms = now_ms + OBSTACLE_TX_INTERVAL_MS;
    mavout::sendObstacleDistance(static_cast<uint64_t>(esp_timer_get_time()));
    mavout::sendUpwardDistance(now_ms);
  }

  if (static_cast<int32_t>(now_ms - g_next_heartbeat_ms) >= 0) {
    g_next_heartbeat_ms = now_ms + HEARTBEAT_INTERVAL_MS;
    mavout::sendHeartbeat();
  }
}
