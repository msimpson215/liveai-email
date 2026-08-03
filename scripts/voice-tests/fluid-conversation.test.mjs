/* A long, messy, realistic conversation — trailing off, changing subject,
   backchannels, re-asking things already answered — run against the REAL
   service. Prints the whole thing so it can be read as a conversation, then
   measures the things that make it feel robotic. */
/* Twenty turns of a real person rambling, against the REAL service.
   Not one-question-one-answer checkboxes - those pass while the thing still
   feels like a robot. This is someone trailing off mid-sentence, grunting,
   getting up to answer the door, changing subject, and re-asking things they
   were already told, which is how patients actually talk.

   What it measures is what makes something feel robotic:
     replies that run long
     the same sentence said twice
     re-introducing itself
     answering "mhm" with a lecture
     leaving you hanging

   Costs OpenAI tokens - it holds a twenty turn conversation. Use deliberately.

   Run:
     node scripts/voice-tests/fluid-conversation.test.mjs [baseUrl] [page]    */
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'https://liveai-email.onrender.com';
const PAGE = process.argv[3] || '/stress-test.html';

function rec() {
  window.__said = [];
  const O = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new O(...a);
    const oc = pc.createDataChannel.bind(pc);
    pc.createDataChannel = function (...b) {
      const dc = oc(...b);
      dc.addEventListener('message', ev => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'response.audio_transcript.done' || m.type === 'response.output_audio_transcript.done')
            window.__said.push(m.transcript || '');
        } catch (e) {}
      });
      window.__dc = dc;
      return dc;
    };
    return pc;
  };
  window.RTCPeerConnection.prototype = O.prototype;
}

// How a real person actually talks: half sentences, detours, repeats.
const TURNS = [
  'Hi.',
  'Um, so I got this thing scheduled. The heart one.',
  "Yeah. Is that the treadmill? Or...",
  "Okay so what do I—",
  "Sorry, what I meant was, do I have to run on it.",
  'Mhm.',
  'Okay. And the coffee thing? My wife said no coffee.',
  'How long before?',
  'Hang on.',
  "Sorry, my dog was at the door. Where were we?",
  'Right, the coffee. What about tea?',
  'Okay. Actually, different question — how long does the whole thing take?',
  'Yeah.',
  'And can my wife come back with me?',
  'Okay. Wait, you said something about an IV earlier?',
  'Does that hurt?',
  'Alright. Um.',
  'Sorry, I keep asking things. When do I get the results again?',
  "You already told me that, didn't you.",
  "Okay. Thanks, that's all."
];

const browser = await chromium.launch({ args: [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--use-file-for-fake-audio-capture=/tmp/audio/quiet.wav',
  '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.addInitScript(rec);
await page.goto(BASE + PAGE);
await page.waitForTimeout(1500);
if (!(await page.evaluate(() => !!window.__dc))) {
  await page.evaluate(() => {
    if (typeof connectVoice === 'function') return connectVoice();
    if (typeof toggleVoice === 'function') return toggleVoice();
    if (typeof start === 'function') return start();
  });
}
await page.waitForFunction('window.__dc && window.__dc.readyState==="open"', null, { timeout: 25000 });

async function waitFor(prev, maxMs = 15000) {
  for (let i = 0; i < maxMs / 700; i++) {
    await page.waitForTimeout(700);
    if ((await page.evaluate(() => window.__said.length)) > prev) {
      await page.waitForTimeout(800);
      return;
    }
  }
}
await waitFor(0);
const opening = (await page.evaluate(() => window.__said))[0] || '';

const lines = [{ who: 'AXON', text: opening }];
const replies = [];
for (const t of TURNS) {
  const prev = await page.evaluate(() => window.__said.length);
  await page.evaluate(x => {
    window.__dc.send(JSON.stringify({ type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: x }] } }));
    window.__dc.send(JSON.stringify({ type: 'response.create' }));
  }, t);
  await waitFor(prev);
  const all = await page.evaluate(() => window.__said);
  const reply = all.slice(prev).join(' ').replace(/\s+/g, ' ').trim();
  lines.push({ who: 'YOU', text: t });
  lines.push({ who: 'AXON', text: reply || '(nothing)' });
  replies.push({ asked: t, reply });
}
await browser.close();

console.log('\n============== THE CONVERSATION ==============\n');
for (const l of lines) console.log(l.who + ': ' + l.text + '\n');

// ---- what makes it feel robotic ----
console.log('============== HOW IT HELD UP ==============\n');
const words = r => r.split(/\s+/).filter(Boolean).length;
const lens = replies.map(r => words(r.reply));
const avg = (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1);

// verbatim sentences it said more than once
const sentences = {};
for (const r of replies) {
  for (let s of r.reply.split(/(?<=[.!?])\s+/)) {
    s = s.trim().toLowerCase();
    if (s.split(/\s+/).length >= 6) sentences[s] = (sentences[s] || 0) + 1;
  }
}
const repeated = Object.entries(sentences).filter(([, n]) => n > 1);

const head = opening.replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase();
const regreets = replies.filter(r => r.reply.toLowerCase().replace(/\s+/g, ' ').startsWith(head)).length;

// short acknowledgements should get short answers, not a lecture
const backchannels = replies.filter(r => /^(mhm|yeah|okay\.?|alright\.? um\.?|um\.?)$/i.test(r.asked.trim()));
const lecturedAtBackchannel = backchannels.filter(r => words(r.reply) > 45);

const emptyReplies = replies.filter(r => !r.reply || r.reply === '(nothing)');

let bad = 0;
const rule = (label, ok, detail) => { if (!ok) bad++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label.padEnd(46) + ' | ' + detail); };

rule('answers stay short and human', Number(avg) <= 60, 'average ' + avg + ' words per reply');
rule('never repeats a sentence word for word', repeated.length === 0,
  repeated.length ? repeated.length + ' repeated: "' + repeated[0][0].slice(0, 55) + '"' : 'none repeated');
rule('never re-introduces itself', regreets === 0, regreets + ' re-greetings');
rule('a grunt gets a short reply, not a lecture', lecturedAtBackchannel.length === 0,
  backchannels.length + ' backchannels, ' + lecturedAtBackchannel.length + ' over-answered');
rule('never leaves you hanging', emptyReplies.length === 0, emptyReplies.length + ' silent replies');
rule('longest single reply is not a monologue', Math.max(...lens) <= 130, 'longest ' + Math.max(...lens) + ' words');

console.log('\n' + (bad ? bad + ' PROBLEM(S)' : 'it holds a real conversation'));
process.exit(bad ? 1 : 0);
