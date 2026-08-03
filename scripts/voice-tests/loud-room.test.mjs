/* Can it still hear you when the room is loud?

   The noise fix had a nasty failure mode: the local voice detector was allowed
   to veto a real transcript, so with a speaker cranked it stopped recognising
   the caller at all and just sat there saying "listening". This guards that.

   Setup:
     npm install --no-save playwright && npx playwright install chromium
     scripts/voice-tests/make-audio.sh
   Run:
     node scripts/voice-tests/loud-room.test.mjs [baseUrl]                     */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const BASE=process.argv[2]||null;
const PUB=process.cwd()+'/public',PORT=8150; let server=null;
if(!BASE){server=http.createServer((rq,rs)=>{const f=path.join(PUB,decodeURIComponent(rq.url.split('?')[0]));
 if(!f.startsWith(PUB)||!fs.existsSync(f)){rs.writeHead(404);return rs.end();}
 rs.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':'text/html'});rs.end(fs.readFileSync(f));});
 await new Promise(r=>server.listen(PORT,r));}
const ORIGIN=BASE||'http://127.0.0.1:'+PORT;
function stubs(){window.__sent=[];const rf=window.fetch;
 window.fetch=async(u,o)=>{if(String(u).includes('/session'))return{ok:true,json:async()=>({value:'k'})};
  if(String(u).includes('openai.com'))return{ok:true,text:async()=>'v=0\r\n'};return rf(u,o);};
 window.RTCPeerConnection=class{constructor(){this.ontrack=null;this._l={}}
  addEventListener(t,fn){(this._l[t]=this._l[t]||[]).push(fn)}
  get iceConnectionState(){return 'connected'}
  get connectionState(){return 'connected'}
  createDataChannel(){const ls={};window.__dc={readyState:'open',send(m){window.__sent.push(JSON.parse(m))},addEventListener(t,f){(ls[t]=ls[t]||[]).push(f)},_fire(t,d){(ls[t]||[]).forEach(f=>f(d))}};return window.__dc}
  addTrack(){}async createOffer(){return{type:'offer',sdp:'x'}}async setLocalDescription(){}
  async setRemoteDescription(){const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator(),g=c.createGain();g.gain.value=0;o.connect(g);g.connect(d);o.start();window.__aiGain=g;if(this.ontrack)this.ontrack({streams:[d.stream]})}
  close(){}};}
async function turn(pageUrl,clip,transcript){
  const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/tmp/audio/'+clip,'--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage(); await p.addInitScript(stubs);
  await p.goto(ORIGIN+'/'+pageUrl); await p.waitForTimeout(400);
  await p.evaluate(()=>{try{if(typeof connectVoice==='function')return connectVoice();if(typeof toggleVoice==='function')return toggleVoice();if(typeof start==='function')return start();}catch(e){}}).catch(()=>{});
  await p.waitForFunction('window.__dc && window.__aiGain',null,{timeout:15000});
  await p.waitForTimeout(1300);
  await p.evaluate(()=>{window.__dc._fire('message',{data:JSON.stringify({type:'response.created'})});window.__dc._fire('message',{data:JSON.stringify({type:'response.done'})});window.__sent.length=0;});
  await p.waitForTimeout(300);
  await p.evaluate(()=>window.__dc._fire('message',{data:JSON.stringify({type:'input_audio_buffer.speech_started'})}));
  await p.waitForTimeout(2200);
  await p.evaluate(t=>{window.__dc._fire('message',{data:JSON.stringify({type:'input_audio_buffer.speech_stopped'})});
    if(t!==null)window.__dc._fire('message',{data:JSON.stringify({type:'conversation.item.input_audio_transcription.completed',transcript:t})});},transcript);
  await p.waitForTimeout(3200);
  const r=await p.evaluate(()=>window.__sent.filter(m=>m.type==='response.create').length>0);
  await b.close(); return r;
}
const CASES=[
  ['quiet room, person asks',            'speech_norm.wav','how much for a bollard', true],
  ['music behind them',                  'music_speech10.wav','how much for a bollard', true],
  ['music almost as loud as them',       'music_speech3.wav','how much for a bollard', true],
  ['SPEAKER CRANKED, music louder',      'music_over3.wav','how much for a bollard', true],
  ['SPEAKER CRANKED HARD, much louder',  'music_over9.wav','hello hello', true],
  ['music only, nobody talking',         'music_norm.wav','', false],
  ['fart on your turn',                  'fart.wav','you', false],
];
console.log('\nCan it still hear you in a loud room? — '+(BASE?'LIVE':'local'));
console.log('-'.repeat(64));
let bad=0;
for(const [label,clip,tr,want] of CASES){
  const got=await turn('talk.html?src=email',clip,tr);
  const ok=got===want; if(!ok)bad++;
  console.log(label.padEnd(36),(want?'should answer':'should ignore').padEnd(15),(got?'answered':'ignored').padEnd(9),ok?'PASS':'FAIL');
}
console.log('\n'+(bad?bad+' FAILED':'all good'));
if(server)await new Promise(r=>server.close(r));
process.exit(bad?1:0);
