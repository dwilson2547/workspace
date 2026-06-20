// led-vu-meter — bring-up smoke test
// Board: Adafruit Matrix Portal M4 (SAMD51)  |  Panel: 64x32 HUB75
//
// Purpose (milestone 2, step 1): confirm the toolchain, the matrix, and the analog
// front-end all work together — before we add ADC-DMA or any FFT.
//   * A dim diagonal sweep proves Protomatter refreshes smoothly.
//   * A1 (node N of the front-end) is read and drawn as a live green level bar.
//   * Raw ADC is printed over USB serial (115200) a few times a second.
//
// What you should see:
//   * Idle (no audio): bar sits near mid-screen, lined up with the red reference tick
//     (~2010 counts = your 1.62 V mid-rail). Serial prints ~2000-2050.
//   * Plug in audio + play music: the bar jumps and dances with the signal.
//
// NOTE: this still uses blocking analogRead(). Continuous ADC-DMA — the actual timing
// risk we need to retire — comes in the next sketch.

#include <Adafruit_Protomatter.h>

// Standard Matrix Portal M4 HUB75 pin map (from Adafruit's examples).
uint8_t rgbPins[]  = {7, 8, 9, 10, 11, 12};
uint8_t addrPins[] = {17, 18, 19, 20, 21};
uint8_t clockPin   = 14;
uint8_t latchPin   = 15;
uint8_t oePin      = 16;

#define WIDTH   64
#define HEIGHT  32
#define ADC_PIN A1

// width, bit-depth(4), #chains(1), rgbPins, #addr lines(4 for 32-tall), clk/latch/oe,
// double-buffered(true) for tear-free animation.
Adafruit_Protomatter matrix(
  WIDTH, 4, 1, rgbPins, 4, addrPins,
  clockPin, latchPin, oePin, true);

uint32_t frame = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);              // SAMD51 ADC: 0..4095

  ProtomatterStatus status = matrix.begin();
  Serial.print("Protomatter begin() status: ");
  Serial.println((int)status);           // 0 == PROTOMATTER_OK
  if (status != PROTOMATTER_OK) {
    for (;;);                            // halt — check panel wiring / power
  }
}

void loop() {
  // --- read the analog front-end (light averaging settles the SAR S/H vs ~2.35k node Z) ---
  uint32_t acc = 0;
  const int N = 16;
  for (int i = 0; i < N; i++) acc += analogRead(ADC_PIN);
  uint16_t adc = acc / N;                // 0..4095

  // --- animated background: dim diagonal sweep proves smooth refresh ---
  matrix.fillScreen(0);
  for (int x = 0; x < WIDTH; x++) {
    int y = (x + frame) % HEIGHT;
    matrix.drawPixel(x, y, matrix.color565(0, 40, 60));
  }

  // --- live level bar from the ADC ---
  int barW = map(adc, 0, 4095, 0, WIDTH);
  uint16_t green = matrix.color565(0, 255, 80);
  for (int x = 0; x < barW; x++) {
    matrix.drawPixel(x, HEIGHT / 2,     green);
    matrix.drawPixel(x, HEIGHT / 2 - 1, green);
  }

  // --- red reference tick where idle mid-rail should land ---
  int midX = map(2010, 0, 4095, 0, WIDTH);
  matrix.drawPixel(midX, HEIGHT / 2 + 2, matrix.color565(255, 0, 0));

  matrix.show();

  if ((frame & 0x1F) == 0) {             // print ~every 32 frames
    Serial.print("ADC A1 = ");
    Serial.println(adc);
  }
  frame++;
}
