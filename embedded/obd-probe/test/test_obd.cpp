// Host tests for isotp.h and obd.h:  g++ -std=c++17 -Wall -Wextra -o /tmp/test_obd test/test_obd.cpp && /tmp/test_obd
// They show the code follows the standard's framing and formulas. They do not show a car does.
#include <stdio.h>
#include <string.h>
#include "../firmware/obd_probe/isotp.h"
#include "../firmware/obd_probe/obd.h"

static int failures = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); failures++; } } while (0)

using isotp::Result;

// Split a payload into ISO-TP frames the way an ECU would (first frame, then consecutive frames).
static int encode(const uint8_t* p, uint16_t n, uint8_t frames[][8]) {
  int k = 0;
  if (n <= 7) { memset(frames[0], 0, 8); frames[0][0] = n; memcpy(frames[0] + 1, p, n); return 1; }
  memset(frames[0], 0, 8);
  frames[0][0] = 0x10 | (n >> 8); frames[0][1] = n & 0xFF; memcpy(frames[0] + 2, p, 6);
  k = 1;
  uint16_t at = 6; uint8_t sn = 1;
  while (at < n) {
    memset(frames[k], 0, 8);
    frames[k][0] = 0x20 | sn;
    uint16_t c = n - at > 7 ? 7 : n - at;
    memcpy(frames[k] + 1, p + at, c);
    at += c; sn = (sn + 1) & 0x0F; k++;
  }
  return k;
}

static void single_frame_request_and_rpm() {
  uint8_t req[8];
  obd::request(req, obd::MODE_CURRENT, obd::PID_RPM);
  const uint8_t want[8] = {0x02, 0x01, 0x0C, 0, 0, 0, 0, 0};
  CHECK(memcmp(req, want, 8) == 0);

  // reply 7E8 04 41 0C 1A F8: 0x1AF8 = 6904, / 4 = 1726 rpm
  const uint8_t reply[8] = {0x04, 0x41, 0x0C, 0x1A, 0xF8, 0, 0, 0};
  isotp::Rx rx;
  CHECK(rx.feed(reply, 8) == Result::Complete);
  obd::Response r = obd::parse(rx.buf, rx.expected);
  float v = 0;
  CHECK(obd::rpm(r, &v) && v == 1726.0f);
}

static void speed_and_coolant() {
  const uint8_t s[] = {0x41, 0x0D, 0x32};
  float v = 0;
  CHECK(obd::speedKph(obd::parse(s, 3), &v) && v == 50.0f);
  const uint8_t c[] = {0x41, 0x05, 0x7B};  // 0x7B = 123, minus 40
  CHECK(obd::coolantC(obd::parse(c, 3), &v) && v == 83.0f);
  CHECK(!obd::rpm(obd::parse(s, 3), &v));  // wrong pid for the decoder
}

static void vin_from_a_multiframe_reply() {
  // 20-byte reply: 49 02 01 then "1G1JC5444R7252367". Frames written out by hand from the ASCII codes.
  const uint8_t f0[8] = {0x10, 0x14, 0x49, 0x02, 0x01, 0x31, 0x47, 0x31};
  const uint8_t f1[8] = {0x21, 0x4A, 0x43, 0x35, 0x34, 0x34, 0x34, 0x52};
  const uint8_t f2[8] = {0x22, 0x37, 0x32, 0x35, 0x32, 0x33, 0x36, 0x37};
  isotp::Rx rx;
  CHECK(rx.feed(f0, 8) == Result::NeedFlowControl);
  CHECK(rx.feed(f1, 8) == Result::None);
  CHECK(rx.feed(f2, 8) == Result::Complete);
  CHECK(rx.expected == 20);
  char vin[18];
  CHECK(obd::vin(obd::parse(rx.buf, rx.expected), vin));
  CHECK(strcmp(vin, "1G1JC5444R7252367") == 0);

  uint8_t fc[8];
  isotp::flowControl(fc);
  CHECK(fc[0] == 0x30 && fc[1] == 0 && fc[2] == 0);
  CHECK(obd::physicalRequestId(0x7E8) == 0x7E0 && obd::physicalRequestId(0x7EB) == 0x7E3);
}

static void long_messages_and_sequence_wrap() {
  uint8_t payload[130];
  for (int i = 0; i < 130; i++) payload[i] = (uint8_t)(i * 7 + 3);
  uint8_t frames[24][8];
  int n = encode(payload, 130, frames);  // 6 + 18 * 7 >= 130: 18 consecutive frames, so the sequence wraps 15 -> 0
  isotp::Rx rx;
  Result last = Result::None;
  for (int i = 0; i < n; i++) last = rx.feed(frames[i], 8);
  CHECK(n == 19 && frames[16][0] == 0x20);  // the 16th consecutive frame is number 0
  CHECK(last == Result::Complete && rx.expected == 130 && memcmp(rx.buf, payload, 130) == 0);
}

static void padded_last_frame_is_trimmed() {
  uint8_t payload[10] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
  uint8_t frames[4][8];
  int n = encode(payload, 10, frames);
  isotp::Rx rx;
  Result last = Result::None;
  for (int i = 0; i < n; i++) last = rx.feed(frames[i], 8);
  CHECK(last == Result::Complete && rx.expected == 10 && rx.got == 10 && memcmp(rx.buf, payload, 10) == 0);
}

static void bad_sequences_are_errors_not_garbage() {
  uint8_t payload[20] = {0};
  uint8_t frames[4][8];
  int n = encode(payload, 20, frames);
  isotp::Rx rx;
  CHECK(rx.feed(frames[0], 8) == Result::NeedFlowControl);
  CHECK(rx.feed(frames[2], 8) == Result::Error);  // skipped frame 1
  CHECK(!rx.active);
  CHECK(rx.feed(frames[1], 8) == Result::Error);  // a consecutive frame with no first frame
  (void)n;
  const uint8_t shortFf[8] = {0x10, 0x05, 0, 0, 0, 0, 0, 0};  // length 5 belongs in a single frame
  CHECK(rx.feed(shortFf, 8) == Result::Error);
  const uint8_t bigFf[8] = {0x1F, 0xFF, 0, 0, 0, 0, 0, 0};  // 4095 bytes: more than the buffer
  CHECK(rx.feed(bigFf, 8) == Result::Error);
}

static void one_reassembler_per_ecu_keeps_replies_apart() {
  isotp::Rx a, b;
  const uint8_t a0[8] = {0x10, 0x14, 0x49, 0x02, 0x01, 0x31, 0x47, 0x31};
  const uint8_t b0[8] = {0x10, 0x14, 0x49, 0x02, 0x01, 0x32, 0x47, 0x32};
  const uint8_t a1[8] = {0x21, 0x4A, 0x43, 0x35, 0x34, 0x34, 0x34, 0x52};
  const uint8_t b1[8] = {0x21, 0x4A, 0x43, 0x35, 0x34, 0x34, 0x34, 0x52};
  const uint8_t a2[8] = {0x22, 0x37, 0x32, 0x35, 0x32, 0x33, 0x36, 0x37};
  const uint8_t b2[8] = {0x22, 0x37, 0x32, 0x35, 0x32, 0x33, 0x36, 0x38};
  a.feed(a0, 8); b.feed(b0, 8); a.feed(a1, 8); b.feed(b1, 8);
  CHECK(a.feed(a2, 8) == Result::Complete && b.feed(b2, 8) == Result::Complete);
  char va[18], vb[18];
  CHECK(obd::vin(obd::parse(a.buf, a.expected), va) && obd::vin(obd::parse(b.buf, b.expected), vb));
  CHECK(strcmp(va, vb) != 0);
}

static void supported_pids_mask() {
  const uint8_t p[] = {0x41, 0x00, 0x80, 0x00, 0x00, 0x01};  // bit 31 = PID 0x01, bit 0 = PID 0x20
  uint8_t out[32];
  int k = obd::supportedPids(obd::parse(p, 6), out, 32);
  CHECK(k == 2 && out[0] == 0x01 && out[1] == 0x20);
  const uint8_t q[] = {0x49, 0x00, 0x40, 0x00, 0x00, 0x00};  // mode 09: PID 0x02 (VIN) only
  k = obd::supportedPids(obd::parse(q, 6), out, 32);
  CHECK(k == 1 && out[0] == 0x02);
}

static void negative_and_junk_responses() {
  const uint8_t neg[] = {0x7F, 0x09, 0x12};  // service 09, sub-function not supported
  obd::Response r = obd::parse(neg, 3);
  CHECK(r.kind == obd::Response::Negative && r.mode == 0x09 && r.nrc == 0x12);
  const uint8_t junk[] = {0x00};
  CHECK(obd::parse(junk, 1).kind == obd::Response::Bad);
  const uint8_t shortVin[] = {0x49, 0x02, 0x01, 'A', 'B'};
  char v[18];
  CHECK(!obd::vin(obd::parse(shortVin, 5), v));
  const uint8_t badChar[] = {0x49, 0x02, 0x01, '1','G','1','J','C','5','4','4','4','R','7','2','5','2','3','6','-'};
  CHECK(!obd::vin(obd::parse(badChar, 20), v));
}

int main() {
  single_frame_request_and_rpm();
  speed_and_coolant();
  vin_from_a_multiframe_reply();
  long_messages_and_sequence_wrap();
  padded_last_frame_is_trimmed();
  bad_sequences_are_errors_not_garbage();
  one_reassembler_per_ecu_keeps_replies_apart();
  supported_pids_mask();
  negative_and_junk_responses();
  if (failures == 0) printf("all tests passed\n");
  return failures ? 1 : 0;
}
