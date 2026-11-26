// OBD-II (SAE J1979) requests and the few decoders the probe needs, over ISO-TP.
// Formulas are from the standard; nothing here has been run on a vehicle yet.
#pragma once
#include <ctype.h>
#include <stdint.h>
#include <string.h>

namespace obd {

constexpr uint32_t REQUEST_ID   = 0x7DF;  // functional request: every ECU may answer
constexpr uint32_t RESPONSE_MIN = 0x7E8;  // ECU n answers on 0x7E8 + n ...
constexpr uint32_t RESPONSE_MAX = 0x7EF;  // ... for n = 0..7

constexpr uint8_t MODE_CURRENT   = 0x01;
constexpr uint8_t MODE_VEHICLE   = 0x09;
constexpr uint8_t PID_SUPPORTED  = 0x00;  // in both modes: which PIDs 0x01..0x20 exist
constexpr uint8_t PID_COOLANT    = 0x05;
constexpr uint8_t PID_RPM        = 0x0C;
constexpr uint8_t PID_SPEED      = 0x0D;
constexpr uint8_t PID_VIN        = 0x02;  // mode 09

inline bool isResponseId(uint32_t id) { return id >= RESPONSE_MIN && id <= RESPONSE_MAX; }

// Where to send the flow control for a reply from ECU `responseId`: the ECU's own request id.
inline uint32_t physicalRequestId(uint32_t responseId) { return responseId - 8; }

// Single-frame request, padded to 8 bytes. Padding byte is 0x00; some ECUs may want 0x55 or 0xAA.
inline void request(uint8_t out[8], uint8_t mode, uint8_t pid) {
  out[0] = 0x02;
  out[1] = mode;
  out[2] = pid;
  for (int i = 3; i < 8; i++) out[i] = 0x00;
}

struct Response {
  enum Kind : uint8_t { Bad, Positive, Negative } kind = Bad;
  uint8_t mode = 0;
  uint8_t pid = 0;
  uint8_t nrc = 0;             // negative response code, when Negative
  const uint8_t* data = nullptr;  // bytes after the PID, when Positive
  uint16_t n = 0;
};

// `p` is a reassembled ISO-TP message. Positive: [mode+0x40, pid, data...]. Negative: [0x7F, mode, nrc].
inline Response parse(const uint8_t* p, uint16_t len) {
  Response r;
  if (len >= 3 && p[0] == 0x7F) {
    r.kind = Response::Negative; r.mode = p[1]; r.nrc = p[2];
  } else if (len >= 2 && p[0] >= 0x41 && p[0] <= 0x4F) {
    r.kind = Response::Positive; r.mode = p[0] - 0x40; r.pid = p[1]; r.data = p + 2; r.n = len - 2;
  }
  return r;
}

inline bool rpm(const Response& r, float* out) {
  if (r.kind != Response::Positive || r.mode != MODE_CURRENT || r.pid != PID_RPM || r.n < 2) return false;
  *out = (256 * r.data[0] + r.data[1]) / 4.0f;
  return true;
}
inline bool speedKph(const Response& r, float* out) {
  if (r.kind != Response::Positive || r.mode != MODE_CURRENT || r.pid != PID_SPEED || r.n < 1) return false;
  *out = r.data[0];
  return true;
}
inline bool coolantC(const Response& r, float* out) {
  if (r.kind != Response::Positive || r.mode != MODE_CURRENT || r.pid != PID_COOLANT || r.n < 1) return false;
  *out = r.data[0] - 40.0f;
  return true;
}

// A "supported PIDs" reply (PID 0x00, 0x20, ...) holds a 32-bit mask: the top bit is PID base+1.
// Writes the supported PIDs to out[] (up to cap) and returns how many.
inline int supportedPids(const Response& r, uint8_t* out, int cap) {
  if (r.kind != Response::Positive || (r.pid & 0x1F) != 0 || r.n < 4) return 0;
  uint32_t mask = (uint32_t)r.data[0] << 24 | (uint32_t)r.data[1] << 16 | (uint32_t)r.data[2] << 8 | r.data[3];
  int k = 0;
  for (int i = 0; i < 32 && k < cap; i++)
    if (mask >> (31 - i) & 1) out[k++] = (uint8_t)(r.pid + 1 + i);
  return k;
}

// Mode 09 PID 02: [count, 17 ASCII characters], some ECUs pad before the VIN. Takes the last 17 bytes.
inline bool vin(const Response& r, char out[18]) {
  if (r.kind != Response::Positive || r.mode != MODE_VEHICLE || r.pid != PID_VIN || r.n < 17) return false;
  const uint8_t* v = r.data + (r.n - 17);
  for (int i = 0; i < 17; i++) {
    if (!isalnum(v[i])) return false;
    out[i] = (char)v[i];
  }
  out[17] = 0;
  return true;
}

}  // namespace obd
