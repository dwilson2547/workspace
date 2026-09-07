#include "mavlink_out.h"

#include <Arduino.h>

#include "config.h"
#include "sensors.h"

// The generated headers are header-only. MAVLINK_USE_CONVENIENCE_FUNCTIONS is
// tested with #ifdef, not for a value, so defining it to 0 would still pull in a
// comm_send_ch()/mavlink_system we do not provide. Leave it undefined: we pack
// and write the buffer ourselves.
#include <ardupilotmega/mavlink.h>

namespace mavout {
namespace {

HardwareSerial &g_fc = Serial1;

void emit(mavlink_message_t *msg) {
  static uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  const uint16_t len = mavlink_msg_to_send_buffer(buf, msg);
  g_fc.write(buf, len);
}

}  // namespace

void begin() {
  g_fc.begin(FC_BAUD, SERIAL_8N1, PIN_FC_RX, PIN_FC_TX);
}

void sendObstacleDistance(uint64_t now_us) {
  uint16_t distances[MAVLINK_MSG_OBSTACLE_DISTANCE_FIELD_DISTANCES_LEN];

  // Unused tail is UNKNOWN, never 0: zero is a valid distance meaning "touching
  // the sensor". ArduPilot only reads the first 360/increment_f entries anyway.
  for (uint16_t i = 0; i < MAVLINK_MSG_OBSTACLE_DISTANCE_FIELD_DISTANCES_LEN; ++i) {
    distances[i] = UNKNOWN_SENTINEL_CM;
  }

  for (uint8_t i = 0; i < SENSOR_COUNT; ++i) {
    const uint8_t ring_index = sensors::ringIndexFor(i);
    if (ring_index >= RING_COUNT) {
      continue;
    }
    const SensorRuntime &rt = sensors::get(i);
    switch (rt.reading) {
      case Reading::Valid:
        distances[ring_index] = rt.distance_cm;
        break;
      case Reading::Clear:
        // 401 fails ArduPilot's `> max_distance` check exactly as UNKNOWN fails
        // its own, so both land as "no reading for this face". Kept distinct for
        // spec compliance and for any other consumer of this stream.
        distances[ring_index] = CLEAR_SENTINEL_CM;
        break;
      case Reading::Unknown:
        distances[ring_index] = UNKNOWN_SENTINEL_CM;
        break;
    }
  }

  mavlink_message_t msg;
  mavlink_msg_obstacle_distance_pack(
      MAV_SYSID, MAV_COMP_ID_OBSTACLE_AVOIDANCE, &msg,
      now_us,
      MAV_DISTANCE_SENSOR_LASER,
      distances,
      0,  // increment = 0 forces ArduPilot to use increment_f
      MIN_DISTANCE_CM,
      MAX_DISTANCE_CM,
      RING_INCREMENT_DEG,
      RING_ANGLE_OFFSET_DEG,
      MAV_FRAME_BODY_FRD);
  emit(&msg);
}

void sendUpwardDistance(uint32_t now_ms) {
  for (uint8_t i = 0; i < SENSOR_COUNT; ++i) {
    if (SENSOR_MAP[i].role != SlotRole::Up) {
      continue;
    }
    const SensorRuntime &rt = sensors::get(i);

    // AP_Proximity_MAV assigns _distance_upward from this message with NO
    // validity check, unlike the OBSTACLE_DISTANCE path. A 65535 sentinel would
    // be taken literally as a 655 m ceiling. Withholding the message is the
    // correct signal: get_upward_distance() returns false once it goes stale.
    if (rt.reading == Reading::Unknown) {
      return;
    }
    const uint16_t cm =
        (rt.reading == Reading::Clear) ? MAX_DISTANCE_CM : rt.distance_cm;

    mavlink_message_t msg;
    const float quaternion[4] = {0.0f, 0.0f, 0.0f, 0.0f};
    mavlink_msg_distance_sensor_pack(
        MAV_SYSID, MAV_COMP_ID_OBSTACLE_AVOIDANCE, &msg,
        now_ms,
        MIN_DISTANCE_CM,
        MAX_DISTANCE_CM,
        cm,
        MAV_DISTANCE_SENSOR_LASER,
        1,  // sensor id
        MAV_SENSOR_ROTATION_PITCH_90,
        0,        // covariance: unknown
        0.0f,     // horizontal_fov
        0.0f,     // vertical_fov
        quaternion,
        0);       // signal_quality: unknown
    emit(&msg);
    return;
  }
}

void sendHeartbeat() {
  mavlink_message_t msg;
  // ONBOARD_CONTROLLER, not GCS: a GCS heartbeat would tie ArduPilot's GCS
  // failsafe to this ESP32. compid must not be 1 -- that collides with the
  // autopilot itself.
  mavlink_msg_heartbeat_pack(
      MAV_SYSID, MAV_COMP_ID_OBSTACLE_AVOIDANCE, &msg,
      MAV_TYPE_ONBOARD_CONTROLLER,
      MAV_AUTOPILOT_INVALID,
      0,  // base_mode
      0,  // custom_mode
      MAV_STATE_ACTIVE);
  emit(&msg);
}

}  // namespace mavout
