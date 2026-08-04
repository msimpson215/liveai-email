/* A television talking in the same room, with nobody speaking to the orb.

   A microphone cannot solve this. Measured off real recordings through the real
   audio path, a TV and a person land in the same place on every measure one mic
   can make - and the TV is usually the louder of the two:

                     voice band p50   rumble ratio   loudness
       TV / crowd     3.08e-4          0.008          0.0545
       a person       4.94e-4          0.041          0.0465

   The words are what give it away. "And then he told her he'd be back tomorrow"
   is a television; "how much for a parking lot" is a customer. So when the room
   has been producing speech for a few seconds, a turn gets checked against
   /api/addressed before it earns a reply.

   Run:  node scripts/voice-tests/tv-in-the-room.test.mjs [baseUrl]           */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const BASE=process.argv[2]||null;
const PUB=process.cwd()+'/public',PORT=8170; let server=null;
if(!BASE){server=http.createServer((rq,rs)=>{const f=path.join(PUB,decodeURIComponent(rq.url.split('?')[0]));
 if(!f.startsWith(PUB)||!fs.existsSync(f)){rs.writeHead(404);return rs.end();}
 rs.writeHead(200,{'Content-Type':f.endsWith('.js')?'application/javascript':'text/html'});rs.end(fs.readFileSync(f));});
 await new Promise(r=>server.listen(PORT,r));}
const ORIGIN=BASE||'http://127.0.0.1:'+PORT;
function stubs(){window.__sent=[];const rf=window.fetch;
 window.fetch=async(u,o)=>{if(String(u).includes('/session'))return{ok:true,json:async()=>({value:'k',voice:'coral'})};
  if(String(u).includes('openai.com'))return{ok:true,text:async()=>'v=0\r\n'};return rf(u,o)};
 window.RTCPeerConnection=class{constructor(){this.ontrack=null;this._l={}}
  addEventListener(t,fn){(this._l[t]=this._l[t]||[]).push(fn)}
  get iceConnectionState(){return 'connected'} get connectionState(){return 'connected'}
  createDataChannel(){const ls={};window.__dc={readyState:'open',send(m){window.__sent.push(JSON.parse(m))},addEventListener(t,f){(ls[t]=ls[t]||[]).push(f)},_fire(t,d){(ls[t]||[]).forEach(f=>f(d))}};return window.__dc}
  addTrack(){}async createOffer(){return{type:'offer',sdp:'x'}}async setLocalDescription(){}
  async setRemoteDescription(){const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator(),g=c.createGain();g.gain.value=0;o.connect(g);g.connect(d);o.start();window.__aiGain=g;if(this.ontrack)this.ontrack({streams:[d.stream]})}
  close(){}};}
async function turn(clip,transcript){
  const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/tmp/audio/'+clip,'--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage(); await p.addInitScript(stubs);
  await p.goto(ORIGIN+'/talk.html?src=email'); await p.waitForTimeout(1500);
  await p.waitForFunction('window.__dc && window.__aiGain',null,{timeout:15000});
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{window.__dc._fire('message',{data:JSON.stringify({type:'response.created'})});window.__dc._fire('message',{data:JSON.stringify({type:'response.done'})});window.__sent.length=0;});
  await p.waitForTimeout(8000);            // let the room's own level settle
  await p.evaluate(()=>window.__dc._fire('message',{data:JSON.stringify({type:'input_audio_buffer.speech_started'})}));
  await p.waitForTimeout(2200);
  await p.evaluate(t=>{window.__dc._fire('message',{data:JSON.stringify({type:'input_audio_buffer.speech_stopped'})});
    window.__dc._fire('message',{data:JSON.stringify({type:'conversation.item.input_audio_transcription.completed',transcript:t})});},transcript);
  await p.waitForTimeout(3200);
  const r=await p.evaluate(()=>window.__sent.filter(m=>m.type==='response.create').length>0);
  await b.close(); return r;
}
// A TV talking in the room transcribes as real sentences. That is the whole problem.
const CASES=[
 ['TV/crowd talking, you silent','bar.wav','and then he told her that he would be back tomorrow',false],
 ['TV talking, you silent (2)','bar.wav','the weather this weekend is going to be nice',false],
 ['you speaking, quiet room','speech_norm.wav','how much for a parking lot',true],
 ['you speaking over the TV','music_over3.wav','how much for a parking lot',true],
];
console.log('\nCan it tell YOU apart from a TV in the room? — '+(BASE?'LIVE':'local'));
console.log('-'.repeat(66));
let bad=0;
for(const [label,clip,tr,want] of CASES){
  const got=await turn(clip,tr);
  const ok=got===want; if(!ok)bad++;
  console.log(label.padEnd(32),(want?'should answer':'should ignore').padEnd(15),(got?'answered':'ignored').padEnd(9),ok?'PASS':'FAIL');
}
console.log('\n'+(bad?bad+' FAILED':'all good'));
if(server)await new Promise(r=>server.close(r));
process.exit(bad?1:0);
