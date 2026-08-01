/* The other half: real recordings played in on the CALLER's turn. Noise must
   never make Axon answer (that is the "Hello, how can I help you today?"
   restart). A person always must.

   Setup:
     npm install --no-save playwright && npx playwright install chromium
     scripts/voice-tests/make-audio.sh
   Run:
     node scripts/voice-tests/real-audio-turns.test.mjs [baseUrl]              */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || null;      // omit to test the local working copy
const PUB = '/workspace/public', PORT = 8126;
let server = null;
if (!BASE) {
  server = http.createServer((req, res) => {
    const f = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(PORT, r));
}
const URL = (BASE || 'http://127.0.0.1:' + PORT) + '/talk.html?src=email';

function stubs() {
  window.__sent = [];
  const rf = window.fetch;
  window.fetch = async (u, o) => {
    if (String(u).includes('/session')) return { ok: true, json: async () => ({ value: 'k' }) };
    if (String(u).includes('openai.com')) return { ok: true, text: async () => 'v=0\r\n' };
    return rf(u, o);
  };
  window.RTCPeerConnection = class {
    constructor() { this.ontrack = null; }
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
      g.gain.value = 0; o.connect(g); g.connect(d); o.start();
      window.__aiGain = g;
      if (this.ontrack) this.ontrack({ streams: [d.stream] });
    }
    close() {}
  };
}

// transcript: what OpenAI would come back with for that sound. null = never arrives.
const CASES = [
  ['wind.wav',        'wind on your turn',            '',            false],
  ['engine.wav',      'engine idling on your turn',   '',            false],
  ['fart.wav',        'a fart on your turn',          'you',         false],
  ['fart.wav',        'a fart, no transcript at all', null,          false],
  ['quiet.wav',       'nobody there',                 '',            false],
  ['speech_norm.wav', 'a person asking something',    'how much for a parking lot', true],
  ['wind_snr6.wav',   'a person asking, in wind',     'how much for a parking lot', true],
];

const results = [];
for (const [clip, label, transcript, wantReply] of CASES) {
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=/tmp/audio/' + clip,
    '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.addInitScript(stubs);
  await page.goto(URL);
  await page.waitForFunction('typeof analyser!=="undefined" && !!analyser', null, { timeout: 20000 });
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    window.__dc._fire('message', { data: JSON.stringify({ type: 'response.created' }) });
    window.__dc._fire('message', { data: JSON.stringify({ type: 'response.done' }) });
    window.__sent.length = 0;
  });
  await page.waitForTimeout(300);

  // The caller's turn: sound happens, then stops.
  await page.evaluate(() => window.__dc._fire('message',
    { data: JSON.stringify({ type: 'input_audio_buffer.speech_started' }) }));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__dc._fire('message',
    { data: JSON.stringify({ type: 'input_audio_buffer.speech_stopped' }) }));
  if (transcript !== null) {
    await page.evaluate(t => window.__dc._fire('message', { data: JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed', transcript: t }) }), transcript);
  }
  await page.waitForTimeout(3200);        // long enough for the fallback timer

  const replies = await page.evaluate(() =>
    window.__sent.filter(m => m.type === 'response.create').length);
  const ok = (replies > 0) === wantReply;
  results.push({ label, wantReply, replies, ok });
  await browser.close();
}

console.log('\nReal recordings on the caller\'s turn — ' + (BASE ? 'LIVE SITE' : 'local working copy') + '\n');
console.log('what happened in the room'.padEnd(34), 'should answer'.padEnd(14), 'did answer');
console.log('-'.repeat(64));
let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(r.label.padEnd(34), (r.wantReply ? 'yes' : 'no').padEnd(14),
    (r.replies > 0 ? 'yes' : 'no').padEnd(6), r.ok ? 'PASS' : 'FAIL');
}
console.log('\n' + (bad ? bad + ' FAILED' : 'noise never makes it answer; a person always does'));
if (server) await new Promise(r => server.close(r));
process.exit(bad ? 1 : 0);
