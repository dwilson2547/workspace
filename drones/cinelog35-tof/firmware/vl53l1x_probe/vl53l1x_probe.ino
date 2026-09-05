#include <Wire.h>
#include <VL53L1X.h>

constexpr uint8_t SDA_PIN = 8;
constexpr uint8_t SCL_PIN = 9;
constexpr uint8_t VL53L1X_ADDRESS = 0x29;

VL53L1X sensor;

bool devicePresent(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void haltWithMessage(const char *message) {
  Serial.println(message);
  Serial.println("Check 3V3, GND, SDA=GPIO8, and SCL=GPIO9, then reset.");
  while (true) {
    delay(1000);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("CL35 VL53L1X sensor probe");

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  if (!devicePresent(VL53L1X_ADDRESS)) {
    haltWithMessage("FAIL: no I2C device responded at the VL53L1X default address 0x29.");
  }
  Serial.println("PASS: I2C device found at 0x29.");

  sensor.setTimeout(500);
  if (!sensor.init()) {
    haltWithMessage("FAIL: device responded, but VL53L1X initialization failed.");
  }
  Serial.println("PASS: VL53L1X initialized.");

  sensor.setDistanceMode(VL53L1X::Long);
  sensor.setMeasurementTimingBudget(50000);
  sensor.startContinuous(100);

  Serial.println("Move a target in front of the sensor; readings are in millimetres.");
  Serial.println("distance_mm,status,signal_mcps,ambient_mcps");
}

void loop() {
  sensor.read();

  if (sensor.timeoutOccurred()) {
    Serial.println("TIMEOUT");
    return;
  }

  Serial.print(sensor.ranging_data.range_mm);
  Serial.print(',');
  Serial.print(VL53L1X::rangeStatusToString(sensor.ranging_data.range_status));
  Serial.print(',');
  Serial.print(sensor.ranging_data.peak_signal_count_rate_MCPS, 2);
  Serial.print(',');
  Serial.println(sensor.ranging_data.ambient_count_rate_MCPS, 2);
}
