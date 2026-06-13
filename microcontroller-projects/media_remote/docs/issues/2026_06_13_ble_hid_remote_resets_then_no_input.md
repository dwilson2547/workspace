# XIAO ESP32-S3 BLE media remote reset on every button press and, once stable, delivered no HID input to the host

**Date:** 2026-06-13
**Component:** `esp32_s3_media_remote/esp32_s3_media_remote.ino` — `initBleHid`, `sendBleConsumerUsage`, `sendBleKeyboardReport`; `platformio.ini`
**Severity:** Critical — the device was completely non-functional: it crash-looped on boot, panicked on every media button, and even after those were fixed it controlled nothing on the paired host.

---

## Observed symptom

Initial report: "shorting any of the pins to ground causes the whole device to reset." The remote (Seeed XIAO ESP32-S3, BLE HID keyboard + consumer-control composite) was reported to reset whenever a button pin was shorted to GND. Troubleshooting via serial revealed the symptoms were actually a sequence of distinct failures, each masking the next:

1. The board was in a **continuous boot loop** (`esp_reset_reason()` = `ESP_RST_PANIC`), crashing during BLE init before it could advertise stably. The "reset on pin short" was the board already rebooting ~once per second; the timing merely lined up with probing.
2. After fixing the boot loop, **every media button caused a `Guru Meditation Error: LoadProhibited` panic** (`EXCCAUSE 0x1c`), reboot. The no-op button (`D6`) never crashed.
3. After moving to the correct BLE stack, the device connected and sent reports successfully (`connected=1`, `send returned OK`) but **the phone did nothing** — no media control, no volume change.
4. Pairing churn: repeated disconnects (`reason=531` = remote terminated) and `encrypted=0 bonded=0` at connect time.

Powered over USB from a PC; client was an Android/iOS phone that already listed the device as a "keyboard."

---

## Root cause

### 1. `setBatteryLevel()` called before services started → assert → boot loop

`initBleHid()` called `bleHid->setBatteryLevel(100)` **before** `startServices()`. In the Arduino BLE HID library, `setBatteryLevel()` immediately calls `notify()` on the battery characteristic, and `notify()` asserts the characteristic's service is started:

```
assert failed: void BLECharacteristic::notify(bool) BLECharacteristic.cpp:1092 (getService() != nullptr)
```

The assert aborts → panic → reboot, forever. `setup()` never completed, so the device could never advertise stably.

### 2. Wrong BLE stack for composite HID: duplicate-UUID characteristics silently dropped

The decisive finding: the installed core (`framework-arduinoespressif32` 3.3.4 / libs 5.5.0) is built with **`CONFIG_BT_BLUEDROID_ENABLED` unset and `CONFIG_BT_NIMBLE_ENABLED=y`** — i.e. the BLE backend is **NimBLE**, not Bluedroid. The core's bundled Kolban `BLE` wrapper (`BLEDevice.h` / `BLEHIDDevice.h`) has a NimBLE-mode branch in `BLEService::addCharacteristic` that **drops any characteristic whose UUID already exists**:

```cpp
BLECharacteristic *pExisting = m_characteristicMap.getByUUID(pCharacteristic->getUUID());
#if defined(CONFIG_NIMBLE_ENABLED)
  if (pExisting != nullptr) {
    pExisting->m_removed = 0;          // reuse existing; new one is NOT added to the map
  } else
#endif
  { m_characteristicMap.setByUUID(...); }
```

A keyboard + consumer composite HID device needs three Report characteristics — keyboard input, keyboard output, consumer input — **all of which use UUID `0x2a4d`**. Only the first survived; the 2nd and 3rd were never added to the service map, so `executeCreate()` never ran on them, their `m_pService` was never set, and their handle stayed `NULL_HANDLE` (`0xffff`). Calling `notify()` on the consumer report then dereferenced an uninitialised service pointer → `LoadProhibited`. Confirmed empirically: a boot diagnostic printed `handle=0xffff` for both input reports.

### 3. HID key-down and key-up coalesced into one BLE connection event

`sendBleConsumerUsage()` / `sendBleKeyboardReport()` sent the "press" notification immediately followed by the "release" notification with no delay. Serial timestamps showed both notifications occurring in the **same millisecond**, so both were delivered within a single BLE connection event. The host saw the report value go `usage → 0x0000` within one event and registered no keypress. This is why everything reported success on the device side yet nothing happened on the phone.

### 4. Stale bonds in NVS blocked encryption on re-pair

The device was reflashed many times; BLE bond keys persist in NVS across flashes. After the phone "forgot" the device and created a fresh bond, the ESP32 still held the old keys, so encryption could not re-establish — producing disconnect churn (`reason=531`) and `encrypted=0 bonded=0`. HOGP hosts ignore HID reports on an unencrypted link. Clearing the ESP32-side bonds restored clean pairing (`encrypted=1 bonded=1`).

---

## Troubleshooting steps taken

1. **Asked the user to characterise the failure (power source, paired vs unpaired, which pins, serial access)** — established it reset only when paired and only on pins that send BLE, which split the diagnosis between a notify-path crash and a power brownout.

2. **Built a PlatformIO wrapper around the existing sketch and added serial diagnostics** (`esp_reset_reason()` on boot, per-button logging with heap before/after the send) — required creating a Python 3.12 conda env because the installed `pio` ran on Python 3.14, which the ESP32 platform rejects.

3. **Read the reset reason instead of guessing** — first capture showed `ESP_RST_PANIC` and a continuous boot loop, ruling out brownout and proving a firmware crash during BLE init.

4. **Decoded the panic backtrace with `addr2line`** — pointed at `initBleHid` line `setBatteryLevel()` → `BLEHIDDevice::setBatteryLevel` → `BLECharacteristic::notify` → assert. Confirmed against the library source (root cause 1).

5. **After fixing the ordering, captured the per-button crash** — `LoadProhibited` with `getService()` returning a consistent garbage pointer; backtrace landed in `sendBleConsumerUsage` → `notify`. Added a diagnostic printing each input report's handle, which showed `0xffff` (unregistered) for both.

6. **Read the library source to find why registration failed** — traced `addCharacteristic` / `executeCreate` / the `ADD_CHAR_EVT` handler; discovered handle matching uses `m_lastCreatedCharacteristic`, not UUID, ruling out a handle-collision theory.

7. **Inspected the precompiled `sdkconfig`** — found NimBLE (not Bluedroid) is the active backend, which made the NimBLE-mode duplicate-UUID drop in `addCharacteristic` the real mechanism (root cause 2).

8. **Switched to NimBLE-Arduino and verified registration** — boot diagnostic showed both report characteristics non-null/registered; button presses no longer panicked.

9. **Added connection-security and CCCD-subscribe logging** — confirmed `encrypted=1 bonded=1` and that the host subscribed to **both** KEYBOARD and CONSUMER reports, eliminating connection, encryption, and subscription as causes.

10. **Cleared stale ESP32 bonds** — resolved the pairing churn and `encrypted=0` (root cause 4); the link then reliably reached `encrypted=1 bonded=1`.

11. **Inspected send timing in the logs** — press/release notifications shared a timestamp; added a hold delay between them, after which the phone responded to media and volume controls (root cause 3). Confirmed working by the user.

---

## Fix

### `platformio.ini` / `.ino` includes — switch from the bundled BLE wrapper to NimBLE-Arduino

The composite HID device requires multiple `0x2a4d` Report characteristics, which the bundled wrapper drops in NimBLE mode. NimBLE-Arduino's `NimBLEHIDDevice` locates report characteristics by report-ID + type and fully supports duplicate UUIDs.

```ini
lib_deps = h2zero/NimBLE-Arduino@^2.2.3
```

```cpp
#include <NimBLEDevice.h>
#include <NimBLEHIDDevice.h>
```

`initBleHid()` was rewritten on the NimBLE API (`NimBLEDevice::init`, `setSecurityAuth`/`setSecurityIOCap`, `NimBLEServerCallbacks` with the 2.x signatures, `NimBLEHIDDevice` getters, `bleServer->start()`, `NimBLEAdvertising`).

### `initBleHid` — start services before setting battery level

```cpp
bleServer->start();        // starts all registered services
bleHid->setBatteryLevel(100);  // NimBLE setBatteryLevel defaults to notify=false, so safe
```

This prevents the premature `notify()` that caused the original boot-loop assert.

### `sendBleConsumerUsage` / `sendBleKeyboardReport` — hold the key before releasing

```cpp
// press
chr->setValue(payload, len);
chr->notify();
delay(KEY_HOLD_MS);   // 60 ms — span a BLE connection event so the host sees a distinct press
// release
chr->setValue(release, len);
chr->notify();
```

`KEY_HOLD_MS = 60` ensures key-down and key-up land in separate connection events.

### `triggerUnpair` / `updateButtons` — wire the `D6` "unpair" button and stop wiping bonds on boot

A temporary boot-time `NimBLEDevice::deleteAllBonds()` was used to clear stale bonds during diagnosis. It was removed (it would otherwise force a re-pair on every power cycle) and replaced with a hold-to-unpair action on `D6` (previously a no-op): holding it `UNPAIR_HOLD_MS` (3 s) calls `deleteAllBonds()` then `ESP.restart()`.

---

## Files changed

- `esp32_s3_media_remote/esp32_s3_media_remote.ino` — `initBleHid`, `sendBleConsumerUsage`, `sendBleKeyboardReport`, `triggerUnpair`, `updateButtons`, `onButtonPressed`, `ServerCallbacks`, `ReportSubscribeCallbacks`, includes, `ActionType`/`BUTTONS` table
- `platformio.ini` — added `lib_deps = h2zero/NimBLE-Arduino`, PlatformIO wrapper around the existing sketch (new file created during troubleshooting)
- `serial_logger.py` — resilient USB-CDC serial logger used for diagnosis (new file created during troubleshooting)
