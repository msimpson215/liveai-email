/* END TO END against the REAL OpenAI Realtime service.
   Real session token from the live server, real WebRTC to OpenAI, real model,
   real audio played in as the microphone. Nothing stubbed.
   This is the same engine the ChatGPT voice app runs on. */
/* A probe, not a test. Opens a REAL session against the live server and the
   REAL OpenAI Realtime service - the same engine the ChatGPT voice app runs on -
   plays a recording in as the microphone, and prints exactly what came back.

   This costs OpenAI tokens each run. Keep it short and use it deliberately.

   Setup:
     npm install --no-save playwright && npx playwright install chromium
     scripts/voice-tests/make-audio.sh
   Run:
     node scripts/voice-tests/live-openai.probe.mjs wind.wav "wind" 20         */
import { chromium } from 'playwright';

const BASE = 'https://liveai-email.onrender.com';
const clip = process.argv[2] || 'speech_norm.wav';
const label = process.argv[3] || clip;
const SECONDS = Number(process.argv[4] || 16);

function recorder() {
  window.__log = [];
  window.__sentOut = [];
  const OrigPC = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new OrigPC(...a);
    const origCreate = pc.createDataChannel.bind(pc);
    pc.createDataChannel = function (...b) {
      const dc = origCreate(...b);
      const origSend = dc.send.bind(dc);
      dc.send = function (m) { try { window.__sentOut.push(JSON.parse(m)); } catch (e) {} return origSend(m); };
      dc.addEventListener('message', ev => {
        try {
          const m = JSON.parse(ev.data);
          window.__log.push({ t: Date.now(), type: m.type,
            transcript: m.transcript || (m.delta && m.delta.length < 60 ? m.delta : undefined) });
        } catch (e) {}
      });
      window.__dc = dc;
      return dc;
    };
    pc.addEventListener('iceconnectionstatechange', () =>
      window.__log.push({ t: Date.now(), type: 'ice:' + pc.iceConnectionState }));
    window.__pc = pc;
    return pc;
  };
  window.RTCPeerConnection.prototype = OrigPC.prototype;
}

const browser = await chromium.launch({ args: [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--use-file-for-fake-audio-capture=/tmp/audio/' + clip,
  '--autoplay-policy=no-user-gesture-required',
] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 160)));
await page.addInitScript(recorder);
await page.goto(BASE + '/talk.html?src=email');
await page.waitForTimeout(600);
await page.evaluate(() => { if (typeof start === 'function') return start(); });

await page.waitForTimeout(SECONDS * 1000);

const out = await page.evaluate(() => ({
  ice: window.__pc ? window.__pc.iceConnectionState : 'no pc',
  log: window.__log,
  sent: window.__sentOut.map(m => m.type),
}));
await browser.close();

const t0 = out.log.length ? out.log[0].t : 0;
const rel = ms => ((ms - t0) / 1000).toFixed(1) + 's';
const interesting = new Set(['response.created', 'response.done', 'response.cancelled',
  'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped',
  'input_audio_buffer.committed', 'conversation.item.input_audio_transcription.completed',
  'response.audio_transcript.done', 'error']);

console.log('\n=== ' + label + ' — REAL OpenAI, real audio ===');
console.log('ice:', out.ice, '| events:', out.log.length, '| we sent:', JSON.stringify(out.sent));
for (const e of out.log) {
  if (!interesting.has(e.type) && !e.type.startsWith('ice:')) continue;
  console.log(' ', rel(e.t).padStart(6), e.type, e.transcript ? '→ ' + JSON.stringify(String(e.transcript).slice(0, 90)) : '');
}
const replies = out.log.filter(e => e.type === 'response.created').length;
const said = out.log.filter(e => e.type === 'response.audio_transcript.done').map(e => e.transcript);
console.log('  replies generated:', replies);
if (said.length) said.forEach((s, i) => console.log('  it said #' + (i + 1) + ':', JSON.stringify(String(s).slice(0, 140))));
