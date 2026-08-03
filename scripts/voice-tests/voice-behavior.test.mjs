/* Drives a real voice page in a headless DOM with a fake mic, fake speaker and
   fake Realtime data channel, and checks the things that actually matter in a
   demo: noise never triggers a reply, noise never cuts Axon off, a person
   always does, and a misreading of the room corrects itself.

   Run:  node scripts/voice-tests/voice-behavior.test.mjs [public/talk.html ...]
   Needs jsdom:  npm install --no-save jsdom                                  */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['public/talk.html', 'public/a1.html'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runPage(pageFile) {
  const html = fs.readFileSync(path.resolve(pageFile), 'utf8');
  // What the fake microphone and fake speaker are producing right now.
  const SIM = { mic: { level: 0.001, profile: 'quiet' }, ai: { level: 0 } };
  const sent = [];

  function makeAnalyser(kind) {
    let fftSize = 2048;
    return {
      smoothingTimeConstant: 0,
      set fftSize(v) { fftSize = v; },
      get fftSize() { return fftSize; },
      get frequencyBinCount() { return fftSize / 2; },
      connect() {},
      getByteTimeDomainData(arr) {
        const level = kind === 'ai' ? SIM.ai.level : SIM.mic.level;
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.max(0, Math.min(255,
            Math.round(128 + 128 * level * Math.SQRT2 * Math.sin(i / 6))));
        }
      },
      getByteFrequencyData(arr) {
        // Shapes match what real recordings measure: a person has almost no
        // energy below 150 Hz, wind and engines are almost all below it.
        const hzPerBin = 24000 / arr.length;
        const p = SIM.mic.profile;
        for (let i = 0; i < arr.length; i++) {
          const hz = i * hzPerBin;
          if (p === 'voice') arr[i] = (hz >= 150 && hz <= 3000) ? 215 : 30;
          else if (p === 'rumble') arr[i] = hz < 150 ? 215 : 25;   // wind, engine, thump
          else arr[i] = 15;                                        // near silence
        }
      },
    };
  }

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://liveai-email.onrender.com/' + path.basename(pageFile),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async (url) => String(url).includes('/session')
        ? { ok: true, json: async () => ({ value: 'ek_test' }) }
        : { ok: true, text: async () => 'v=0\r\n', json: async () => ({}) };
      const track = () => ({ enabled: true, kind: 'audio', stop() {}, clone: () => track() });
      w.navigator.mediaDevices = {
        getUserMedia: async () => {
          const t = track();
          return { getAudioTracks: () => [t], getTracks: () => [t] };
        },
      };
      w.MediaStream = class { constructor(t) { this._t = t || []; } getAudioTracks() { return this._t; } };
      w.RTCPeerConnection = class {
        constructor() { this.ontrack = null; this._l = {}; }
        addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
        get iceConnectionState() { return 'connected'; }
        get connectionState() { return 'connected'; }
        createDataChannel() {
          const ls = {};
          w.__dc = {
            readyState: 'open',
            send(m) { sent.push(JSON.parse(m)); },
            addEventListener(t, fn) { (ls[t] ||= []).push(fn); },
            _fire(t, d) { (ls[t] || []).forEach(fn => fn(d)); },
          };
          return w.__dc;
        }
        addTrack() {}
        async createOffer() { return { type: 'offer', sdp: 'x' }; }
        async setLocalDescription() {}
        async setRemoteDescription() { if (this.ontrack) this.ontrack({ streams: [new w.MediaStream([])] }); }
        close() {}
      };
      w.AudioContext = class {
        constructor() { this.state = 'running'; this.sampleRate = 48000; this._n = 0; }
        createMediaStreamSource() { return { connect() {} }; }
        // The room monitor is created first, the AI-speaker meter second.
        createAnalyser() { this._n++; return makeAnalyser(this._n === 1 ? 'mic' : 'ai'); }
        resume() { return Promise.resolve(); }
        close() {}
      };
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    },
  });

  const w = dom.window;
  await sleep(600);
  const dc = w.__dc;
  if (!dc) throw new Error(pageFile + ': data channel never opened');
  dc._fire('open');
  await sleep(50);

  const msg = o => dc._fire('message', { data: JSON.stringify(o) });
  const creates = () => sent.filter(m => m.type === 'response.create').length;
  const cancels = () => sent.filter(m => m.type === 'response.cancel').length;

  msg({ type: 'response.created' });
  msg({ type: 'response.done' });          // greeting finished
  await sleep(100);
  const afterGreeting = creates();

  const results = [];
  const check = (label, got, want) => results.push({ label, got, want, ok: got === want });

  // A thump / gust / fart on the caller's turn.
  SIM.mic = { level: 0.20, profile: 'rumble' };
  msg({ type: 'input_audio_buffer.speech_started' });
  await sleep(400);
  SIM.mic = { level: 0.001, profile: 'quiet' };
  msg({ type: 'input_audio_buffer.speech_stopped' });
  msg({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'you' });
  await sleep(200);
  check('noise on your turn does NOT trigger a reply', creates() - afterGreeting, 0);

  // A real person.
  SIM.mic = { level: 0.12, profile: 'voice' };
  msg({ type: 'input_audio_buffer.speech_started' });
  await sleep(500);
  SIM.mic = { level: 0.001, profile: 'quiet' };
  msg({ type: 'input_audio_buffer.speech_stopped' });
  await sleep(150);
  check('real speech DOES get a reply, with no transcript wait', creates() - afterGreeting, 1);

  // Wind while Axon is mid-sentence.
  msg({ type: 'response.created' });
  SIM.ai.level = 0.30;
  await sleep(250);
  const c3 = cancels();
  SIM.mic = { level: 0.25, profile: 'rumble' };
  await sleep(1500);
  check('wind does NOT cut Axon off', cancels() - c3, 0);

  // A person deliberately talking over Axon.
  SIM.mic = { level: 0.14, profile: 'voice' };
  await sleep(900);
  check('talking over Axon DOES interrupt', cancels() - c3, 1);
  SIM.ai.level = 0; SIM.mic = { level: 0.001, profile: 'quiet' };
  await sleep(900);

  // The conversation carries on afterwards.
  const c5 = creates();
  SIM.mic = { level: 0.12, profile: 'voice' };
  msg({ type: 'input_audio_buffer.speech_started' });
  await sleep(500);
  SIM.mic = { level: 0.001, profile: 'quiet' };
  msg({ type: 'input_audio_buffer.speech_stopped' });
  await sleep(150);
  check('conversation continues after barge-in', creates() - c5, 1);

  // A barge-in that leads nowhere must switch itself off. Axon has to have been
  // talking into a quiet room first, otherwise the crowd guard blocks it anyway.
  msg({ type: 'response.created' });
  SIM.ai.level = 0.30;
  await sleep(1500);
  const c6 = cancels();
  SIM.mic = { level: 0.14, profile: 'voice' };
  await sleep(800);
  check('misfire cuts in once', cancels() - c6, 1);
  SIM.mic = { level: 0.001, profile: 'quiet' };
  await sleep(4300);
  check('barge-in parks itself after a misfire', w.eval('bargeEnabled'), false);

  msg({ type: 'response.created' });
  SIM.ai.level = 0.30;
  await sleep(1500);
  const c7 = cancels();
  SIM.mic = { level: 0.14, profile: 'voice' };
  await sleep(900);
  check('parked barge-in no longer chops Axon up', cancels() - c7, 0);

  SIM.ai.level = 0; SIM.mic = { level: 0.001, profile: 'quiet' };
  dom.window.close();
  return results;
}

let failed = 0;
for (const page of pages) {
  console.log('\n' + page);
  console.log('-'.repeat(60));
  for (const r of await runPage(page)) {
    if (!r.ok) failed++;
    console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.label + '   (got ' + r.got + ', want ' + r.want + ')');
  }
}
console.log('\n' + (failed ? failed + ' FAILED' : 'all voice behaviour checks passed'));
process.exit(failed ? 1 : 0);
