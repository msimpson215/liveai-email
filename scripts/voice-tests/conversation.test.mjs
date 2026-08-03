/* What "a conversation" actually means, as a checklist, run end to end against
   the REAL OpenAI service on the live site. Prints the whole thing as a
   transcript so it can be read like a conversation, then judges each rule. */
/* What "a conversation" means, written down as rules and checked end to end
   against the REAL OpenAI service on the live site.

   This exists because the noise work was done one reported bug at a time -
   fix the thing Marty tripped over, wait for him to trip over the next one.
   These are the things a person expects without having to ask:

     it answers a plain question
     you can cut it off mid-sentence
     "hold on a second" makes it wait, politely and briefly
     it does not talk to itself while you are away
     "I'm back, continue" continues - it does NOT start over
     it remembers what you said earlier
     it will repeat itself when asked
     it greets you exactly once, ever

   Costs OpenAI tokens - it holds a real conversation. Use deliberately.

   Setup:
     npm install --no-save playwright && npx playwright install chromium
   Run:
     node scripts/voice-tests/conversation.test.mjs [baseUrl] [page]          */
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'https://liveai-email.onrender.com';
const PAGE = process.argv[3] || '/stress-test.html';

function rec() {
  window.__said = [];
  window.__events = [];
  const O = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new O(...a);
    window.__pc = pc;
    const oc = pc.createDataChannel.bind(pc);
    pc.createDataChannel = function (...b) {
      const dc = oc(...b);
      dc.addEventListener('message', ev => {
        try {
          const m = JSON.parse(ev.data);
          window.__events.push(m.type);
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

const browser = await chromium.launch({ args: [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--use-file-for-fake-audio-capture=/tmp/audio/quiet.wav',
  '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.addInitScript(rec);
await page.goto(BASE + PAGE);
// Some orbs start themselves. Only nudge the ones that don't, or we end up with
// two calls fighting over the same page.
await page.waitForTimeout(1500);
const started = await page.evaluate(() => !!window.__dc);
if (!started) {
  await page.evaluate(() => {
    if (typeof connectVoice === 'function') return connectVoice();
    if (typeof toggleVoice === 'function') return toggleVoice();
    if (typeof start === 'function') return start();
  });
}
await page.waitForFunction('window.__dc && window.__dc.readyState==="open"', null, { timeout: 25000 });

const transcript = [];
async function waitForReply(prev, maxMs = 16000) {
  const step = 700;
  for (let i = 0; i < maxMs / step; i++) {
    await page.waitForTimeout(step);
    const n = await page.evaluate(() => window.__said.length);
    if (n > prev) {
      await page.waitForTimeout(900);          // let it finish the sentence
      return await page.evaluate(() => window.__said);
    }
  }
  return await page.evaluate(() => window.__said);
}

async function say(text) {
  const prev = await page.evaluate(() => window.__said.length);
  await page.evaluate(t => {
    window.__dc.send(JSON.stringify({ type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: t }] } }));
    window.__dc.send(JSON.stringify({ type: 'response.create' }));
  }, text);
  const said = await waitForReply(prev);
  const reply = said.slice(prev).join(' ');
  transcript.push({ who: 'YOU', text });
  transcript.push({ who: 'AXON', text: reply || '(said nothing)' });
  return reply;
}

// The opening
const opening = (await waitForReply(0))[0] || '';
transcript.push({ who: 'AXON', text: opening });

const results = [];
const check = (rule, pass, detail) => results.push({ rule, pass, detail });

// 1. Answers a plain question
const a1 = await say('Hi, I would like to know about the test.');
check('answers a plain question', a1.length > 20, a1.slice(0, 60));

// 2. Interrupted mid-answer, the way barge-in does it
const prevCount = await page.evaluate(() => window.__said.length);
await page.evaluate(() => {
  window.__dc.send(JSON.stringify({ type: 'conversation.item.create',
    item: { type: 'message', role: 'user', content: [{ type: 'input_text',
      text: 'Tell me every single step of the test in detail, start to finish.' }] } }));
  window.__dc.send(JSON.stringify({ type: 'response.create' }));
});
await page.waitForTimeout(4500);                        // let it get going
await page.evaluate(() => window.__dc.send(JSON.stringify({ type: 'response.cancel' })));
await page.waitForTimeout(1200);
const cutText = (await page.evaluate(() => window.__said)).slice(prevCount).join(' ');
transcript.push({ who: 'YOU', text: '(long question, then cut it off partway)' });
transcript.push({ who: 'AXON', text: cutText || '(cut off before it produced a transcript)' });

// 3. "Hold on" — it must wait, not fill the silence
const beforeHold = await page.evaluate(() => window.__said.length);
await page.evaluate(() => {
  window.__dc.send(JSON.stringify({ type: 'conversation.item.create',
    item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Sorry, hold on one second.' }] } }));
  window.__dc.send(JSON.stringify({ type: 'response.create' }));
});
const holdSaid = await waitForReply(beforeHold);
const holdReply = holdSaid.slice(beforeHold).join(' ');
transcript.push({ who: 'YOU', text: 'Sorry, hold on one second.' });
transcript.push({ who: 'AXON', text: holdReply || '(said nothing)' });
check('holds politely and briefly when asked to wait',
  holdReply.length > 0 && holdReply.length < 200, holdReply.slice(0, 80));

// 4. Silence — it must not talk to itself
const beforeQuiet = await page.evaluate(() => window.__said.length);
await page.waitForTimeout(9000);
const afterQuiet = await page.evaluate(() => window.__said.length);
check('stays quiet while you are away', afterQuiet === beforeQuiet,
  afterQuiet === beforeQuiet ? 'silent for 9s' : 'it spoke unprompted');

// 5. Coming back — must continue, NOT restart
const resume = await say("Okay, I'm back. Please continue.");
const restarted = /^\s*(hi there|hello|hi[,.]|i'm here to answer|welcome)/i.test(resume.trim());
check('continues instead of starting over', !restarted && resume.length > 15,
  restarted ? 'IT GREETED AGAIN' : resume.slice(0, 70));

// 6. Remembers what was said earlier
const recall = await say('What was the very first thing I asked you about?');
check('remembers earlier in the conversation',
  /test|about the test|nuclear|stress/i.test(recall), recall.slice(0, 70));

// 7. Repeats on request
const again = await say('Sorry, could you say that last part again?');
check('will repeat itself when asked', again.length > 15, again.slice(0, 70));

// 8. Never greets twice
// Count replies that repeat the opening line, whatever that opening happens to be.
const head = opening.replace(/\s+/g, ' ').trim().slice(0, 45).toLowerCase();
const greetings = (await page.evaluate(() => window.__said))
  .filter(s => head && String(s).replace(/\s+/g, ' ').trim().toLowerCase().startsWith(head)).length;
check('only ever greets once', greetings <= 1, greetings + ' greeting(s)');

await browser.close();

console.log('\n================ THE CONVERSATION ================\n');
for (const line of transcript) {
  console.log(line.who + ': ' + String(line.text).replace(/\s+/g, ' ').slice(0, 300));
  console.log('');
}
console.log('================ THE RULES ================\n');
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.rule.padEnd(44) + ' | ' + r.detail);
}
console.log('\n' + (failed ? failed + ' FAILED' : 'it holds a conversation'));
process.exit(failed ? 1 : 0);
