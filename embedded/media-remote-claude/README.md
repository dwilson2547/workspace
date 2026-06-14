# ESP32 BLE Media Remote

This project turns an ESP32 into a Bluetooth LE media remote that behaves like a keyboard consumer-control device.

## Features

- 3x3 matrix keypad input with software debounce
- BLE media keys:
  - Play/Pause
  - Next Track
  - Previous Track
  - Volume Up
  - Volume Down
  - Mute
  - Stop
- Dedicated backlight toggle key
- One intentionally unassigned key (reserved for future use)
- Status LED behavior:
  - Slow blink while advertising
  - Solid when connected
  - Brief flash on key press

## Key Map (3x3)

| Position | Action |
| --- | --- |
| Row 1, Col 1 | Play/Pause |
| Row 1, Col 2 | Next Track |
| Row 1, Col 3 | Previous Track |
| Row 2, Col 1 | Volume Up |
| Row 2, Col 2 | Volume Down |
| Row 2, Col 3 | Mute |
| Row 3, Col 1 | Stop |
| Row 3, Col 2 | Backlight Toggle |
| Row 3, Col 3 | Unassigned |

## Hardware Notes

- Firmware currently targets `esp32-c3-devkitm-1` in `platformio.ini`.
- Pins are defined in `src/main.cpp` and should be updated for your exact board/wiring:
  - `ROW_PINS`
  - `COL_PINS`
  - `STATUS_LED_PIN`
  - `BACKLIGHT_PIN`
- Key matrix assumes rows are outputs and columns use `INPUT_PULLUP` (pressed = LOW).

## Build & Flash (PlatformIO)

```bash
pio run
pio run -t upload
pio device monitor -b 115200
```

## Pairing / Usage

1. Power on the device.
2. Pair from your phone/tablet/computer as **ESP32 Media Remote**.
3. Use the 3x3 pad for media controls.
