// led-vu-meter — milestone 3: FFT spectrum, 12 log-spaced bands
// Board: Adafruit Matrix Portal M4 (SAMD51)  |  Panel: 64x32 HUB75
//
// Pipeline: ADC0 free-run -> DMA circular buffer -> Hann window -> 512-pt real FFT
// (arduinoFFT) -> group bins into 12 LOG-spaced bands -> manual gain + per-band
// attack/decay + peak-hold -> 12 vertical bars on the panel.
//
// Gain is manual (board Up/Down buttons); no auto-gain. See decisions 0001-0004.
// A1 = PA05 = ADC0/AIN5. Protomatter is timer-ISR (TC4/TC3), uses no DMA -> our ADC-DMA
// is conflict-free.

#include <Adafruit_Protomatter.h>
#include <arduinoFFT.h>

// ---- panel ----
uint8_t rgbPins[]  = {7, 8, 9, 10, 11, 12};
uint8_t addrPins[] = {17, 18, 19, 20, 21};
uint8_t clockPin   = 14;
uint8_t latchPin   = 15;
uint8_t oePin      = 16;
#define ROTATION 0     // 0/2 = landscape (64 wide x 32 tall); 2 flips 180°
Adafruit_Protomatter matrix(64, 4, 1, rgbPins, 4, addrPins, clockPin, latchPin, oePin, true);

// ---- audio / ADC-DMA ----
#define ADC_PIN     A1
#define ADC_MUXPOS  5          // PA05 / ADC0-AIN5
#define FFT_N       512        // power of 2
#define FS_HZ       13000.0f   // nominal free-run rate (measured ~13 kHz); for band mapping

volatile uint16_t adcBuf[FFT_N];
__attribute__((__aligned__(16))) static DmacDescriptor base_descriptor;
__attribute__((__aligned__(16))) static DmacDescriptor wb_descriptor;

// ---- FFT ----
float vReal[FFT_N];
float vImag[FFT_N];
ArduinoFFT<float> FFT = ArduinoFFT<float>(vReal, vImag, FFT_N, FS_HZ);

// ---- bands ----
#define NUM_BANDS  12
#define F_LOW      40.0f
#define F_HIGH     6000.0f     // just under Nyquist (~6.5 kHz)
int   binLo[NUM_BANDS], binHi[NUM_BANDS];
float disp[NUM_BANDS]   = {0};   // smoothed bar height 0..1
float peak[NUM_BANDS]   = {0};   // peak-hold 0..1
float nfloor[NUM_BANDS];         // adaptive per-band noise floor (sqrt-magnitude units)

// ---- meter / manual gain ----
#define FULLSCALE   800.0f     // sqrt(band-energy)*gain that fills a bar (tune w/ gain)
#define LEVEL_GATE  0.04f      // per-band noise gate -> dark idle
#define GAIN_MIN    0.25f
#define GAIN_MAX    32.0f
#define BTN_UP      2          // PB22 "UP"  (active-low, pull-up)
#define BTN_DOWN    3          // PB23 "DOWN"
float    gain           = 4.0f;
uint32_t gainShownUntil = 0;

// ---------- ADC-DMA (proven in firmware/dma_rms) ----------
void setupADCfreerun() {
  analogReadResolution(12);
  (void)analogRead(ADC_PIN);                 // let the core set ref/res/pin-mux
  ADC0->CTRLA.bit.ENABLE = 0;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_ENABLE);
  ADC0->INPUTCTRL.bit.MUXPOS = ADC_MUXPOS;
  ADC0->INPUTCTRL.bit.MUXNEG = ADC_INPUTCTRL_MUXNEG_GND_Val;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_INPUTCTRL);
  ADC0->SAMPCTRL.bit.SAMPLEN = 16;
  ADC0->CTRLA.bit.PRESCALER  = ADC_CTRLA_PRESCALER_DIV128_Val;
  ADC0->CTRLB.bit.FREERUN    = 1;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_CTRLB);
  ADC0->CTRLA.bit.ENABLE = 1;
  while (ADC0->SYNCBUSY.reg & ADC_SYNCBUSY_ENABLE);
  ADC0->SWTRIG.bit.START = 1;
}

void setupDMA() {
  DMAC->CTRL.bit.DMAENABLE = 0;
  DMAC->CTRL.bit.SWRST = 1;
  while (DMAC->CTRL.bit.SWRST);
  DMAC->BASEADDR.reg = (uint32_t)&base_descriptor;
  DMAC->WRBADDR.reg  = (uint32_t)&wb_descriptor;
  DMAC->CTRL.reg = DMAC_CTRL_DMAENABLE | DMAC_CTRL_LVLEN(0xF);
  DMAC->Channel[0].CHCTRLA.reg =
      DMAC_CHCTRLA_TRIGSRC(ADC0_DMAC_ID_RESRDY) | DMAC_CHCTRLA_TRIGACT_BURST;
  base_descriptor.BTCTRL.reg = DMAC_BTCTRL_VALID | DMAC_BTCTRL_BLOCKACT_INT |
                               DMAC_BTCTRL_BEATSIZE_HWORD | DMAC_BTCTRL_DSTINC;
  base_descriptor.BTCNT.reg    = FFT_N;
  base_descriptor.SRCADDR.reg  = (uint32_t)&ADC0->RESULT.reg;
  base_descriptor.DSTADDR.reg  = (uint32_t)(adcBuf + FFT_N);
  base_descriptor.DESCADDR.reg = (uint32_t)&base_descriptor;
  DMAC->Channel[0].CHCTRLA.bit.ENABLE = 1;
}

void setup() {
  Serial.begin(115200);
  if (matrix.begin() != PROTOMATTER_OK) { for (;;); }
  matrix.setRotation(ROTATION);
  pinMode(BTN_UP, INPUT_PULLUP);
  pinMode(BTN_DOWN, INPUT_PULLUP);

  // precompute log-spaced band -> FFT-bin ranges
  float ratio = powf(F_HIGH / F_LOW, 1.0f / NUM_BANDS);
  float f = F_LOW;
  for (int b = 0; b < NUM_BANDS; b++) {
    int lo = (int)(f * FFT_N / FS_HZ + 0.5f);
    f *= ratio;
    int hi = (int)(f * FFT_N / FS_HZ + 0.5f);
    if (lo < 1) lo = 1;
    if (hi <= lo) hi = lo + 1;
    if (hi > FFT_N / 2) hi = FFT_N / 2;
    binLo[b] = lo; binHi[b] = hi;
    nfloor[b] = 1e9f;            // snaps down to the real floor on the first frames
  }

  setupADCfreerun();
  setupDMA();
}

void loop() {
  // --- grab a time-ordered frame starting at the DMA write cursor; remove DC ---
  int remaining = wb_descriptor.BTCNT.reg;        // beats left in current block
  int widx = FFT_N - remaining;
  if (widx < 0 || widx >= FFT_N) widx = 0;
  float sum = 0;
  for (int i = 0; i < FFT_N; i++) {
    int j = widx + i; if (j >= FFT_N) j -= FFT_N;
    vReal[i] = (float)adcBuf[j];
    vImag[i] = 0.0f;
    sum += vReal[i];
  }
  float mean = sum / FFT_N;
  for (int i = 0; i < FFT_N; i++) vReal[i] -= mean;

  // --- FFT ---
  FFT.windowing(FFTWindow::Hann, FFTDirection::Forward);
  FFT.compute(FFTDirection::Forward);
  FFT.complexToMagnitude();                        // vReal[0..FFT_N/2] = magnitudes

  // --- manual gain via Up/Down (hold to ramp) ---
  bool up = (digitalRead(BTN_UP) == LOW), down = (digitalRead(BTN_DOWN) == LOW);
  if (up)   gain *= 1.015f;
  if (down) gain *= 0.985f;
  gain = constrain(gain, GAIN_MIN, GAIN_MAX);
  if (up || down) gainShownUntil = millis() + 1000;

  // --- group bins into bands; gain + gate + attack/decay + peak-hold ---
  for (int b = 0; b < NUM_BANDS; b++) {
    float m = 0;
    for (int i = binLo[b]; i < binHi[b]; i++) m += vReal[i];
    float mag = sqrtf(m);
    // adaptive noise floor: follow down instantly, creep up slowly
    if (mag < nfloor[b]) nfloor[b] = mag;
    else                 nfloor[b] += (mag - nfloor[b]) * 0.001f;
    float net = mag - nfloor[b] * 1.3f;             // subtract floor + margin
    if (net < 0) net = 0;
    float level = constrain(net * gain / FULLSCALE, 0.0f, 1.0f);
    if (level < LEVEL_GATE) level = 0.0f;
    if (level > disp[b]) disp[b] = level;          // fast attack
    else                 disp[b] *= 0.80f;         // decay
    if (disp[b] > peak[b]) peak[b] = disp[b];
    else                   peak[b] -= 0.015f;
    peak[b] = constrain(peak[b], 0.0f, 1.0f);
  }

  // --- draw 12 bars ---
  int W = matrix.width(), H = matrix.height();
  matrix.fillScreen(0);
  for (int b = 0; b < NUM_BANDS; b++) {
    int x0 = b * W / NUM_BANDS, x1 = (b + 1) * W / NUM_BANDS;  // x1-1 leaves a 1px gap
    int bh = (int)(disp[b] * H + 0.5f);
    for (int y = 0; y < bh; y++) {
      int row = H - 1 - y;
      float fr = (float)y / H;
      uint16_t c = (fr < 0.6f) ? matrix.color565(0, 255, 0)
                 : (fr < 0.85f) ? matrix.color565(255, 200, 0)
                                : matrix.color565(255, 0, 0);
      for (int x = x0; x < x1 - 1; x++) matrix.drawPixel(x, row, c);
    }
    int pr = H - 1 - (int)(peak[b] * (H - 1));
    for (int x = x0; x < x1 - 1; x++) matrix.drawPixel(x, pr, matrix.color565(255, 255, 255));
  }

  // gain indicator: brief blue bar on the top row
  if (millis() < gainShownUntil) {
    float gpos = logf(gain / GAIN_MIN) / logf(GAIN_MAX / GAIN_MIN);
    int gx = (int)(gpos * W + 0.5f);
    for (int x = 0; x < gx && x < W; x++) matrix.drawPixel(x, 0, matrix.color565(0, 0, 150));
  }
  matrix.show();

  // --- serial: gain + compact 0..9 per-band levels, ~3x/sec ---
  static uint32_t t0 = 0;
  if (millis() - t0 >= 300) {
    t0 = millis();
    Serial.print("gain "); Serial.print(gain, 1); Serial.print(" | ");
    for (int b = 0; b < NUM_BANDS; b++) { Serial.print((int)(disp[b] * 9.99f)); Serial.print(' '); }
    Serial.println();
  }
}
