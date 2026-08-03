/* The decisive test: real recordings played into real Chromium as the mic,
   while the page believes Axon is mid-sentence. Does the reply get cut off?

   Setup:
     npm install --no-save jsdom playwright
     npx playwright install chromium
     scripts/voice-tests/make-audio.sh
   Run:
     node scripts/voice-tests/real-audio.test.mjs                            */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PUB = '/workspace/public', PORT = 8125;
const server = http.createServer((req, res) => {
  const f = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

function stubs() {
  window.__sent = [];
  const rf = window.fetch;
  window.fetch = async (u, o) => {
    if (String(u).includes('/session')) return { ok: true, json: async () => ({ value: 'k' }) };
    if (String(u).includes('openai.com')) return { ok: true, text: async () => 'v=0\r\n' };
    return rf(u, o);
  };
  window.RTCPeerConnection = class {
    constructor() { this.ontrack = null; this._l = {}; }
        addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
        get iceConnectionState() { return 'connected'; }
        get connectionState() { return 'connected'; }
    createDataChannel() {
      const ls = {};
      window.__dc = { readyState: 'open', send(m) { window.__sent.push(JSON.parse(m)); },
        addEventListener(t, fn) { (ls[t] = ls[t] || []).push(fn); },
        _fire(t, d) { (ls[t] || []).forEach(f => f(d)); } };
      return window.__dc;
    }
    addTrack() {}
    async createOffer() { return { type: 'offer', sdp: 'x' }; }
    async setLocalDescription() {}
    async setRemoteDescription() {
      const c = new AudioContext(), d = c.createMediaStreamDestination();
      const o = c.createOscillator(), g = c.createGain();
      g.gain.value = 0; o.frequency.value = 300; o.connect(g); g.connect(d); o.start();
      window.__aiGain = g;                       // turn this up to make Axon "talk"
      if (this.ontrack) this.ontrack({ streams: [d.stream] });
    }
    close() {}
  };
}

const CASES = [
  ['wind.wav',        'wind while Axon is talking',      'no cut'],
  ['engine.wav',      'engine while Axon is talking',    'no cut'],
  ['fart.wav',        'farts/thumps while Axon talks',   'no cut'],
  ['quiet.wav',       'silence while Axon is talking',   'no cut'],
  ['bar.wav',         'bar babble while Axon talks',     'no cut'],
  ['speech_norm.wav', 'a person talking over Axon',      'CUT'],
  ['wind_snr6.wav',   'a person over wind, over Axon',   'CUT'],
];

const results = [];
for (const [clip, label, want] of CASES) {
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=/tmp/audio/' + clip,
    '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.addInitScript(stubs);
  await page.goto('http://127.0.0.1:' + PORT + '/talk.html?src=email');
  await page.waitForFunction('typeof analyser!=="undefined" && !!analyser', null, { timeout: 15000 });
  await page.waitForTimeout(1200);

  // Greeting plays and finishes.
  await page.evaluate(() => {
    window.__dc._fire('message', { data: JSON.stringify({ type: 'response.created' }) });
    window.__dc._fire('message', { data: JSON.stringify({ type: 'response.done' }) });
  });
  await page.waitForTimeout(300);

  // Axon starts a long answer.
  await page.evaluate(() => {
    window.__sent.length = 0;
    window.__aiGain.gain.value = 0.4;
    window.__dc._fire('message', { data: JSON.stringify({ type: 'response.created' }) });
  });
  await page.waitForTimeout(5000);      // five seconds of the room doing its thing

  const info = await page.evaluate(() => ({
    cancels: window.__sent.filter(m => m.type === 'response.cancel').length,
    aiSpeaking: typeof aiSpeaking !== 'undefined' ? aiSpeaking : null,
  }));
  const cut = info.cancels > 0;
  const ok = (want === 'CUT') === cut;
  results.push({ label, want, got: cut ? 'CUT' : 'no cut', ok });
  await browser.close();
}

console.log('\nReal recordings, real browser, Axon mid-sentence\n');
console.log('what the room is doing'.padEnd(36), 'wanted'.padEnd(9), 'happened'.padEnd(9), '');
console.log('-'.repeat(66));
let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(r.label.padEnd(36), r.want.padEnd(9), r.got.padEnd(9), r.ok ? 'PASS' : 'FAIL');
}
console.log('\n' + (bad ? bad + ' FAILED' : 'noise never cuts Axon off; a person always does'));
await new Promise(r => server.close(r));
process.exit(bad ? 1 : 0);
