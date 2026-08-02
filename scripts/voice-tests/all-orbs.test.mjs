/* Every voice page on the site, checked with real recordings played into a real
   browser as the microphone. This exists because the fix once landed on three
   pages and the other nine were left broken — including the demo link that
   actually gets sent to people.

   Setup:
     npm install --no-save playwright && npx playwright install chromium
     scripts/voice-tests/make-audio.sh
   Run:
     node scripts/voice-tests/all-orbs.test.mjs [baseUrl]                      */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || null;
const PUB = '/workspace/public', PORT = 8131;
let server = null;
if (!BASE) {
  server = http.createServer((req, res) => {
    const f = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      'Content-Type': f.endsWith('.js') ? 'application/javascript' : 'text/html'
    });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(PORT, r));
}
const ORIGIN = BASE || 'http://127.0.0.1:' + PORT;

// Pages that run a voice orb, with whatever query they need to start.
const PAGES = [
  'talk.html?src=email',
  'a1.html?src=a1tony',
  'demo.html?src=siteeye',
  'siteeye-ai.html',
  'ask.html?t=pricing',
  'axon.html',
  'axon-brain.html',
  'mockup1.html',
  'mockup2.html',
  'stress-test.html',
  'email-plate.html',
];

function stubs() {
  window.__sent = [];
  window.__started = false;
  const rf = window.fetch;
  window.fetch = async (u, o) => {
    if (String(u).includes('/session')) {
      window.__gated = String(u).includes('gate=1');
      return { ok: true, json: async () => ({ value: 'k', model: 'gpt-realtime' }) };
    }
    if (String(u).includes('openai.com')) return { ok: true, text: async () => 'v=0\r\n' };
    return rf(u, o);
  };
  window.RTCPeerConnection = class {
    constructor() { this.ontrack = null; window.__started = true; }
    createDataChannel() {
      const ls = {};
      const dc = { readyState: 'open', send(m) { window.__sent.push(JSON.parse(m)); },
        addEventListener(t, fn) { (ls[t] = ls[t] || []).push(fn); },
        _fire(t, d) { (ls[t] || []).forEach(f => f(d)); } };
      window.__dc = dc;
      return dc;
    }
    addTrack() {}
    async createOffer() { return { type: 'offer', sdp: 'x' }; }
    async setLocalDescription() {}
    async setRemoteDescription() {
      const c = new AudioContext(), d = c.createMediaStreamDestination();
      const o = c.createOscillator(), g = c.createGain();
      g.gain.value = 0; o.frequency.value = 300; o.connect(g); g.connect(d); o.start();
      window.__aiGain = g;
      if (this.ontrack) this.ontrack({ streams: [d.stream] });
    }
    close() {}
  };
}

async function openOrb(page, url) {
  await page.goto(url);
  await page.waitForTimeout(400);
  // Call the page's own entry point. Clicking the orb is not enough on the
  // pages that gate the UI behind a name prompt or a topic slug, and it is the
  // voice path we care about here, not the chrome around it.
  await page.evaluate(() => {
    try {
      if (typeof connectVoice === 'function') return connectVoice();
      if (typeof toggleVoice === 'function') return toggleVoice();
      if (typeof start === 'function') return start();
    } catch (e) { window.__startErr = String(e); }
  }).catch(() => {});
  try {
    await page.waitForFunction('window.__dc && window.__aiGain', null, { timeout: 12000 });
    return true;
  } catch (e) { return false; }
}

const rows = [];
for (const pageUrl of PAGES) {
  const row = { page: pageUrl.split('?')[0], gated: null, noiseCut: null, personCut: null, noiseReply: null };

  // 1. Wind while the AI is mid-sentence, and a person over the top of it.
  for (const [clip, key] of [['wind.wav', 'noiseCut'], ['speech_norm.wav', 'personCut']]) {
    const browser = await chromium.launch({ args: [
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/audio/' + clip,
      '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    await page.addInitScript(stubs);
    const ok = await openOrb(page, ORIGIN + '/' + pageUrl);
    if (!ok) { row[key] = 'no start'; await browser.close(); continue; }
    row.gated = await page.evaluate(() => !!window.__gated);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      window.__dc._fire('message', { data: JSON.stringify({ type: 'response.created' }) });
      window.__dc._fire('message', { data: JSON.stringify({ type: 'response.done' }) });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__sent.length = 0;
      window.__aiGain.gain.value = 0.4;
      window.__dc._fire('message', { data: JSON.stringify({ type: 'response.created' }) });
    });
    await page.waitForTimeout(5000);
    const cancels = await page.evaluate(() =>
      window.__sent.filter(m => m.type === 'response.cancel').length);
    row[key] = cancels > 0;
    await browser.close();
  }

  // 2. A fart on the caller's turn must not produce an answer.
  {
    const browser = await chromium.launch({ args: [
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/audio/fart.wav',
      '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    await page.addInitScript(stubs);
    const ok = await openOrb(page, ORIGIN + '/' + pageUrl);
    if (ok) {
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        window.__dc._fire('message', { data: JSON.stringify({ type: 'response.created' }) });
        window.__dc._fire('message', { data: JSON.stringify({ type: 'response.done' }) });
        window.__sent.length = 0;
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__dc._fire('message',
        { data: JSON.stringify({ type: 'input_audio_buffer.speech_started' }) }));
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        window.__dc._fire('message', { data: JSON.stringify({ type: 'input_audio_buffer.speech_stopped' }) });
        window.__dc._fire('message', { data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed', transcript: 'you' }) });
      });
      await page.waitForTimeout(3200);
      row.noiseReply = await page.evaluate(() =>
        window.__sent.filter(m => m.type === 'response.create').length > 0);
    } else row.noiseReply = 'no start';
    await browser.close();
  }

  rows.push(row);
  process.stderr.write('checked ' + row.page + '\n');
}

console.log('\nEvery orb, real recordings, ' + (BASE ? 'LIVE SITE' : 'local working copy') + '\n');
console.log('page'.padEnd(20), 'gated'.padEnd(7), 'wind cuts it'.padEnd(14),
  'person cuts in'.padEnd(16), 'fart gets answered');
console.log('-'.repeat(80));
let bad = 0;
for (const r of rows) {
  const problems =
    (r.gated !== true ? 1 : 0) + (r.noiseCut !== false ? 1 : 0) +
    (r.personCut !== true ? 1 : 0) + (r.noiseReply !== false ? 1 : 0);
  if (problems) bad++;
  console.log(r.page.padEnd(20), String(r.gated).padEnd(7), String(r.noiseCut).padEnd(14),
    String(r.personCut).padEnd(16), String(r.noiseReply).padEnd(8), problems ? 'FAIL' : 'PASS');
}
console.log('\nwanted: gated true, wind cuts it false, person cuts in true, fart answered false');
console.log(bad ? bad + ' PAGE(S) FAILED' : 'every orb behaves the same, and behaves correctly');
if (server) await new Promise(r => server.close(r));
process.exit(bad ? 1 : 0);
