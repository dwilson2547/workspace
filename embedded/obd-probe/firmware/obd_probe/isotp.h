// ISO 15765-2 (ISO-TP) framing for classic CAN, enough for OBD-II over 11-bit ids.
// No Arduino or IDF dependencies, so test/test_obd.cpp runs it on the laptop.
#pragma once
#include <stdint.h>
#include <string.h>

namespace isotp {

enum class Result : uint8_t {
  None,             // frame consumed, message not finished
  Complete,         // a whole message is in Rx::buf, Rx::expected bytes long
  NeedFlowControl,  // first frame seen: the caller must send a flow-control frame now
  Error,            // bad frame or out-of-sequence; Rx is reset
};

// One reassembler per responding ECU: two ECUs can answer one request at the same time.
struct Rx {
  static constexpr uint16_t MAX = 256;
  uint8_t buf[MAX];
  uint16_t expected = 0;
  uint16_t got = 0;
  uint8_t nextSn = 1;
  bool active = false;

  void reset() { active = false; expected = got = 0; nextSn = 1; }

  Result feed(const uint8_t* d, uint8_t dlc) {
    if (dlc < 1) return Result::Error;
    switch (d[0] >> 4) {
      case 0: {  // single frame: low nibble is the length
        uint8_t n = d[0] & 0x0F;
        if (n == 0 || n > 7 || n + 1 > dlc) return Result::Error;
        memcpy(buf, d + 1, n);
        expected = got = n;
        active = false;
        return Result::Complete;
      }
      case 1: {  // first frame: 12-bit length, then 6 data bytes
        if (dlc < 8) return Result::Error;
        uint16_t len = ((d[0] & 0x0F) << 8) | d[1];
        if (len < 8 || len > MAX) { reset(); return Result::Error; }
        memcpy(buf, d + 2, 6);
        expected = len;
        got = 6;
        nextSn = 1;
        active = true;
        return Result::NeedFlowControl;
      }
      case 2: {  // consecutive frame: low nibble is the sequence number, 1..15 then 0
        if (!active) return Result::Error;
        if ((d[0] & 0x0F) != nextSn) { reset(); return Result::Error; }
        uint16_t n = expected - got;
        if (n > 7) n = 7;
        if (dlc < 1 + n) { reset(); return Result::Error; }
        memcpy(buf + got, d + 1, n);
        got += n;
        nextSn = (nextSn + 1) & 0x0F;
        if (got >= expected) { active = false; return Result::Complete; }
        return Result::None;
      }
      default:  // flow control (3) or reserved: not for a receiver, ignore
        return Result::None;
    }
  }
};

// Flow control "continue to send", block size 0 (no more flow control), no separation time.
inline void flowControl(uint8_t out[8]) {
  out[0] = 0x30;
  for (int i = 1; i < 8; i++) out[i] = 0x00;
}

}  // namespace isotp
