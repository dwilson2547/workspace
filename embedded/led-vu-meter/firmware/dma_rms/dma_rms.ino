// led-vu-meter — milestone 2: ADC-DMA + RMS level meter
// Board: Adafruit Matrix Portal M4 (SAMD51)  |  Panel: 64x32 HUB75
//
// Retires risk #1 and replaces the bass-only bar with a real level meter:
//   * ADC0 free-runs and DMA (channel 0) streams results into a circular buffer with
//     ZERO CPU per sample — runs in the background while Protomatter refreshes the panel.
//   * Each frame we compute the AC RMS of the buffer (DC/bias removed), so the bar
//     responds to ALL frequencies, not just bass.
//   * Software auto-gain + a dB display curve keep it lively at any volume.
//   * A vertical bar (landscape) lets you confirm orientation; tune ROTATION below.
//   * Serial prints the MEASURED sample rate each second — proof the matrix refresh
//     isn't starving the audio sampling.
//
// Why this is safe (see docs/decisions): Protomatter on SAMD51 is TIMER-ISR based
// (owns TC4/TC3) and uses NO DMA, so our ADC-DMA can't collide with it. We must only
// avoid TC4/TC3 — this sketch uses no timer at all (free-running ADC).
//
// A1 = PA05 = ADC0 / AIN5 (verified in the core variant).

#include <Adafruit_Protomatter.h>

// ---- panel ----
uint8_t rgbPins[]  = {7, 8, 9, 10, 11, 12};
uint8_t addrPins[] = {17, 18, 19, 20, 21};
uint8_t clockPin   = 14;
uint8_t latchPin   = 15;
uint8_t oePin      = 16;

#define ROTATION 1     // 0/2 = native landscape, 1/3 = rotated. Bump until the bar
                       // rises bottom->top in your intended landscape mounting.

Adafruit_Protomatter matrix(
  64, 4, 1, rgbPins, 4, addrPins,
  clockPin, latchPin, oePin, true);

// ---- audio DMA ----
#define ADC_PIN     A1          // PA05 / ADC0-AIN5
#define ADC_MUXPOS  5           // AIN5
#define NSAMPLES    1024        // circular buffer depth (RMS window)

volatile uint16_t adcBuf[NSAMPLES];
uint32_t blockCount = 0;   // full buffers completed (polled, not IRQ — ZeroDMA owns the ISRs)

// DMAC descriptors must be 128-bit aligned. One channel -> one descriptor each.
__attribute__((__aligned__(16))) static DmacDescriptor base_descriptor;
__attribute__((__aligned__(16))) static DmacDescriptor wb_descriptor;

#define MARK(s) do { Serial.println(F(s)); Serial.flush(); } while (0)

void setupADCfreerun() {
  // Prime via the core so ADC0 gets the stock reference (3.3V), 12-bit resolution,
  // prescaler, and PA05 analog pin-mux — then we only flip what we need.
  analogReadResolution(12);
  (void)analogRead(ADC_PIN);
  MARK("  adc: primed");

  ADC0->CTRLA.bit.ENABLE = 0;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_ENABLE);
  MARK("  adc: disabled");

  ADC0->INPUTCTRL.bit.MUXPOS = ADC_MUXPOS;
  ADC0->INPUTCTRL.bit.MUXNEG = ADC_INPUTCTRL_MUXNEG_GND_Val;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_INPUTCTRL);
  MARK("  adc: muxset");

  ADC0->SAMPCTRL.bit.SAMPLEN = 16;        // longer S&H for our ~2.4k node impedance
  ADC0->CTRLA.bit.PRESCALER  = ADC_CTRLA_PRESCALER_DIV128_Val; // lands fs in audio range
  ADC0->CTRLB.bit.FREERUN    = 1;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_CTRLB);
  MARK("  adc: freerun cfg");

  ADC0->CTRLA.bit.ENABLE = 1;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_ENABLE);
  ADC0->SWTRIG.bit.START = 1;             // kick off continuous conversions
  MARK("  adc: started");
}

void setupDMA() {
  // Reset + enable the DMAC with all priority levels.
  DMAC->CTRL.bit.DMAENABLE = 0;
  DMAC->CTRL.bit.SWRST = 1;
  while (DMAC->CTRL.bit.SWRST);
  MARK("  dma: reset");
  DMAC->BASEADDR.reg = (uint32_t)&base_descriptor;
  DMAC->WRBADDR.reg  = (uint32_t)&wb_descriptor;
  DMAC->CTRL.reg = DMAC_CTRL_DMAENABLE | DMAC_CTRL_LVLEN(0xF);
  MARK("  dma: enabled");

  // Channel 0: one beat per ADC0 result-ready, single (BURST) trigger.
  DMAC->Channel[0].CHCTRLA.reg =
      DMAC_CHCTRLA_TRIGSRC(ADC0_DMAC_ID_RESRDY) | DMAC_CHCTRLA_TRIGACT_BURST;

  // Circular descriptor: copy ADC0->RESULT (fixed) into adcBuf (incrementing), then
  // reload itself (DESCADDR -> self) for continuous looping.
  // BLOCKACT_INT: loop to the next descriptor AND raise TCMPL each block (NOACT loops
  // silently, so the throughput poll would never see a completion).
  base_descriptor.BTCTRL.reg = DMAC_BTCTRL_VALID | DMAC_BTCTRL_BLOCKACT_INT |
                               DMAC_BTCTRL_BEATSIZE_HWORD | DMAC_BTCTRL_DSTINC;
  base_descriptor.BTCNT.reg   = NSAMPLES;
  base_descriptor.SRCADDR.reg = (uint32_t)&ADC0->RESULT.reg;
  base_descriptor.DSTADDR.reg = (uint32_t)(adcBuf + NSAMPLES); // end addr for DSTINC
  base_descriptor.DESCADDR.reg = (uint32_t)&base_descriptor;

  DMAC->Channel[0].CHCTRLA.bit.ENABLE = 1;     // block-complete polled via CHINTFLAG.TCMPL
  MARK("  dma: chan enabled");
}

// ---- meter / manual gain ----
// Manual sensitivity set live with the board's Up/Down buttons — no auto-gain (auto-gain's
// attack/release made transients clip while everything else dropped to nothing). A raw-RMS
// noise gate keeps idle dark at any gain. Tune RMS_GATE against the serial `rms` readout.
#define RMS_GATE      18.0f    // below this raw RMS => silence => bar empty
#define FULLSCALE_RMS 1448.0f  // AC RMS of a full-scale sine (amp ~2048) => bar full
#define GAIN_MIN      0.5f
#define GAIN_MAX      128.0f
#define BTN_UP        2        // PB22, MatrixPortal "UP"  (active-low, internal pull-up)
#define BTN_DOWN      3        // PB23, MatrixPortal "DOWN"

float    gain           = 8.0f;  // manual gain; hold Up/Down to ramp
float    peak01         = 0.0f;  // peak-hold marker (0..1)
uint32_t gainShownUntil = 0;     // show the gain indicator until this millis()

void setup() {
  Serial.begin(115200);
  delay(1200);                       // let USB CDC re-enumerate before we print
  Serial.println("boot"); Serial.flush();

  if (matrix.begin() != PROTOMATTER_OK) {
    Serial.println("Protomatter begin() FAILED");
    for (;;);
  }
  Serial.println("matrix ok");
  matrix.setRotation(ROTATION);

  pinMode(BTN_UP, INPUT_PULLUP);     // buttons to GND; pressed reads LOW
  pinMode(BTN_DOWN, INPUT_PULLUP);

  setupADCfreerun();
  Serial.println("adc ok");
  setupDMA();
  Serial.println("dma ok");
}

void loop() {
  // Count completed buffers for the throughput print (block period >> frame, so polling
  // each frame never misses one).
  if (DMAC->Channel[0].CHINTFLAG.bit.TCMPL) {
    DMAC->Channel[0].CHINTFLAG.reg = DMAC_CHINTFLAG_TCMPL;
    blockCount++;
  }

  // --- AC RMS over the circular buffer (DMA writes it concurrently; fine for a meter) ---
  uint32_t sum = 0;
  uint64_t sumsq = 0;
  for (int i = 0; i < NSAMPLES; i++) {
    uint32_t v = adcBuf[i];
    sum   += v;
    sumsq += (uint64_t)v * v;
  }
  float mean   = (float)sum / NSAMPLES;
  float meansq = (float)sumsq / NSAMPLES;
  float var    = meansq - mean * mean;
  float rms    = (var > 0.0f) ? sqrtf(var) : 0.0f;   // AC RMS in ADC counts

  // --- manual gain via Up/Down buttons (active-low; hold to ramp) ---
  bool up   = (digitalRead(BTN_UP)   == LOW);
  bool down = (digitalRead(BTN_DOWN) == LOW);
  if (up)   gain *= 1.03f;                            // ~smooth ramp while held
  if (down) gain *= 0.97f;
  gain = constrain(gain, GAIN_MIN, GAIN_MAX);
  if (up || down) gainShownUntil = millis() + 1000;   // flash the gain readout

  // --- level: fixed manual gain + raw-RMS noise gate (no auto-gain) ---
  float level = (rms < RMS_GATE) ? 0.0f
              : constrain(rms * gain / FULLSCALE_RMS, 0.0f, 1.0f);

  // peak-hold
  if (level > peak01) peak01 = level;
  else                peak01 -= 0.01f;
  peak01 = constrain(peak01, 0.0f, 1.0f);

  // --- draw a vertical bar rising from the bottom (landscape) ---
  int W = matrix.width(), H = matrix.height();
  matrix.fillScreen(0);
  int barH = (int)(level * H + 0.5f);
  for (int y = 0; y < barH; y++) {
    int row = H - 1 - y;                              // bottom-up
    float f = (float)y / H;                           // 0 bottom .. 1 top
    uint16_t c = (f < 0.6f) ? matrix.color565(0, 255, 0)        // green
               : (f < 0.85f) ? matrix.color565(255, 200, 0)     // amber
                             : matrix.color565(255, 0, 0);      // red
    for (int x = 0; x < W; x++) matrix.drawPixel(x, row, c);
  }
  int peakRow = H - 1 - (int)(peak01 * (H - 1));
  for (int x = 0; x < W; x++) matrix.drawPixel(x, peakRow, matrix.color565(255, 255, 255));

  // gain indicator: brief blue bar on the top row, log-mapped over [GAIN_MIN, GAIN_MAX]
  if (millis() < gainShownUntil) {
    float gpos = logf(gain / GAIN_MIN) / logf(GAIN_MAX / GAIN_MIN);  // 0..1
    int gx = (int)(gpos * W + 0.5f);
    for (int x = 0; x < gx && x < W; x++) matrix.drawPixel(x, 0, matrix.color565(0, 0, 150));
  }
  matrix.show();

  // --- once/sec: measured sample rate + level, to prove DMA isn't starved ---
  static uint32_t t0 = 0, lastBlocks = 0;
  uint32_t now = millis();
  if (now - t0 >= 1000) {
    uint32_t blocks = blockCount;
    uint32_t sps = (blocks - lastBlocks) * NSAMPLES * 1000UL / (now - t0);
    lastBlocks = blocks; t0 = now;
    Serial.print("fs ~ "); Serial.print(sps);
    Serial.print(" Hz | rms ");  Serial.print(rms, 1);
    Serial.print(" | gain ");    Serial.print(gain, 1);
    Serial.print(" | level ");   Serial.println(level, 2);
  }
}
