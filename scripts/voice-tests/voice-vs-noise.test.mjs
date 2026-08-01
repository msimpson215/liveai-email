// Simulates the browser AnalyserNode maths used by talk.html / a1.html so the
// voice-vs-noise thresholds can be checked against realistic signals.
const SR = 48000, FFT = 1024, BINS = FFT / 2;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const w = ang * k, wr = Math.cos(w), wi = Math.sin(w);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

// Mirrors AnalyserNode.getByteFrequencyData (Blackman window, dB scale, -100..-30)
function byteFreqData(samples) {
  const re = new Float64Array(FFT), im = new Float64Array(FFT);
  const a0 = 0.42, a1 = 0.5, a2 = 0.08;
  for (let i = 0; i < FFT; i++) {
    const w = a0 - a1 * Math.cos(2 * Math.PI * i / (FFT - 1)) + a2 * Math.cos(4 * Math.PI * i / (FFT - 1));
    re[i] = samples[i] * w;
  }
  fft(re, im);
  const out = new Uint8Array(BINS);
  for (let i = 0; i < BINS; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / FFT;
    const db = 20 * Math.log10(mag || 1e-12);
    out[i] = Math.max(0, Math.min(255, Math.round(255 * (db + 100) / 70)));
  }
  return out;
}

function voiceBandRatio(freqData) {
  const hzPerBin = (SR / 2) / freqData.length;
  let voice = 0, total = 0;
  for (let i = 1; i < freqData.length; i++) {
    const hz = i * hzPerBin;
    if (hz > 6000) break;
    const db = (freqData[i] / 255) * 70 - 100;
    const e = Math.pow(10, db / 10);
    total += e;
    if (hz >= 300 && hz <= 3000) voice += e;
  }
  return total > 0 ? voice / total : 0;
}

const rms = s => Math.sqrt(s.reduce((a, v) => a + v * v, 0) / s.length);
const noise = () => Math.random() * 2 - 1;

function make(fn) {
  const s = new Float64Array(FFT);
  for (let i = 0; i < FFT; i++) s[i] = fn(i / SR, i);
  return s;
}
const tone = (hz, amp) => t => amp * Math.sin(2 * Math.PI * hz * t);
const sum = (...fns) => (t, i) => fns.reduce((a, f) => a + f(t, i), 0);

// Low-passed noise stands in for wind rumble.
function lowNoise(amp, cut) {
  let prev = 0; const k = cut / SR;
  return () => { prev += k * (noise() - prev); return amp * prev * 8; };
}

const signals = {
  'silence (empty room)':      make(sum(lowNoise(0.004, 500))),
  'wind gust':                 make(sum(tone(45, .10), tone(80, .09), tone(130, .06), lowNoise(0.05, 300))),
  'truck / engine rumble':     make(sum(tone(80, .12), tone(160, .08), tone(240, .05), lowNoise(0.03, 250))),
  'door slam / thump':         make(sum(tone(60, .22), tone(120, .12), lowNoise(0.10, 400))),
  'fart (low broadband)':      make(sum(tone(90, .14), tone(180, .10), tone(270, .05), lowNoise(0.06, 350))),
  'person talking (close)':    make(sum(tone(140, .05), tone(500, .11), tone(1100, .09), tone(2100, .06), tone(3000, .03))),
  'person talking (quieter)':  make(sum(tone(150, .02), tone(520, .05), tone(1200, .04), tone(2300, .025))),
  'bar crowd (far voices)':    make(sum(tone(300, .03), tone(700, .035), tone(1400, .03), tone(2200, .02), lowNoise(0.02, 400))),
};

console.log('roomFloor assumed 0.02 (quiet room)\n');
console.log('signal'.padEnd(28), 'level'.padEnd(8), 'voiceBand'.padEnd(11), 'counts as speech?');
console.log('-'.repeat(70));
const FLOOR = 0.02;
const RATIO_MIN = Number(process.env.RATIO || 0.55);
const results = {};
for (const [name, sig] of Object.entries(signals)) {
  const level = rms(sig);
  const ratio = voiceBandRatio(byteFreqData(sig));
  const speechish = level > Math.max(FLOOR * 2.4, 0.022) && ratio > RATIO_MIN;
  results[name] = speechish;
  console.log(name.padEnd(28), level.toFixed(4).padEnd(8), ratio.toFixed(3).padEnd(11), speechish ? 'YES' : 'no');
}

const expect = {
  'silence (empty room)': false, 'wind gust': false, 'truck / engine rumble': false,
  'door slam / thump': false, 'fart (low broadband)': false,
  'person talking (close)': true, 'person talking (quieter)': true,
};
let bad = 0;
console.log('');
for (const [k, want] of Object.entries(expect)) {
  if (results[k] !== want) { console.log('WRONG:', k, 'got', results[k], 'want', want); bad++; }
}
console.log(bad ? bad + ' MISCLASSIFIED' : 'all noise rejected, all speech detected');
console.log('\nbar crowd counts as speech:', results['bar crowd (far voices)'],
  '-> this is why barge-in is disabled once the room is classified loud');
