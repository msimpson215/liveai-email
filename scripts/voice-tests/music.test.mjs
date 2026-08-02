/* Music in the room — the thing people actually do when they say "it's like
   ChatGPT". Music sits right in the speech band, so it is the hardest case for
   any voice detector: it must be ignored, and you must still be heard over it.

   Setup:
     npm install --no-save playwright && npx playwright install chromium
     scripts/voice-tests/make-audio.sh
   Run:
     node scripts/voice-tests/music.test.mjs [baseUrl]                        */
import { chromium } from 'playwright';
const BASE=process.argv[2]||'https://liveai-email.onrender.com';
function stubs(){
  window.__sent=[];
  const rf=window.fetch;
  window.fetch=async(u,o)=>{
    if(String(u).includes('/session'))return{ok:true,json:async()=>({value:'k'})};
    if(String(u).includes('openai.com'))return{ok:true,text:async()=>'v=0\r\n'};
    return rf(u,o);
  };
  window.RTCPeerConnection=class{
    constructor(){this.ontrack=null}
    createDataChannel(){const ls={};window.__dc={readyState:'open',send(m){window.__sent.push(JSON.parse(m))},addEventListener(t,f){(ls[t]=ls[t]||[]).push(f)},_fire(t,d){(ls[t]||[]).forEach(f=>f(d))}};return window.__dc}
    addTrack(){} async createOffer(){return{type:'offer',sdp:'x'}} async setLocalDescription(){}
    async setRemoteDescription(){const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator(),g=c.createGain();g.gain.value=0;o.frequency.value=300;o.connect(g);g.connect(d);o.start();window.__aiGain=g;if(this.ontrack)this.ontrack({streams:[d.stream]})}
    close(){}};
}
async function open(page,url){
  await page.goto(url); await page.waitForTimeout(400);
  await page.evaluate(()=>{try{if(typeof connectVoice==='function')return connectVoice();if(typeof toggleVoice==='function')return toggleVoice();if(typeof start==='function')return start();}catch(e){}}).catch(()=>{});
  await page.waitForFunction('window.__dc && window.__aiGain',null,{timeout:15000});
}
async function run(clip,mode){
  const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/tmp/audio/'+clip,'--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage(); await p.addInitScript(stubs);
  await open(p,BASE+'/demo.html?src=convo');
  await p.waitForTimeout(1300);
  await p.evaluate(()=>{window.__dc._fire('message',{data:JSON.stringify({type:'response.created'})});window.__dc._fire('message',{data:JSON.stringify({type:'response.done'})});});
  await p.waitForTimeout(300);
  let out;
  if(mode==='aiTalking'){
    await p.evaluate(()=>{window.__sent.length=0;window.__aiGain.gain.value=0.4;window.__dc._fire('message',{data:JSON.stringify({type:'response.created'})});});
    await p.waitForTimeout(5200);
    out=await p.evaluate(()=>window.__sent.filter(m=>m.type==='response.cancel').length>0);
  }else{
    await p.evaluate(()=>{window.__sent.length=0;window.__dc._fire('message',{data:JSON.stringify({type:'input_audio_buffer.speech_started'})});});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>{window.__dc._fire('message',{data:JSON.stringify({type:'input_audio_buffer.speech_stopped'})});window.__dc._fire('message',{data:JSON.stringify({type:'conversation.item.input_audio_transcription.completed',transcript:'how much for a bollard'})});});
    await p.waitForTimeout(3200);
    out=await p.evaluate(()=>window.__sent.filter(m=>m.type==='response.create').length>0);
  }
  await b.close(); return out;
}
const CASES=[
  ['music_norm.wav','aiTalking','music playing while Axon talks','no cut',false],
  ['music_norm.wav','yourTurn','music playing, nobody talking','no answer',false],
  ['music_speech10.wav','yourTurn','you talking, music in background','answers',true],
  ['music_speech3.wav','yourTurn','you talking, music almost as loud','answers',true],
  ['music_speech10.wav','aiTalking','you talk over Axon w/ music on','cuts in',true],
];
console.log('\nMusic test — LIVE SITE, demo.html?src=convo\n');
console.log('scenario'.padEnd(36),'wanted'.padEnd(11),'got');
console.log('-'.repeat(62));
let bad=0;
for(const [clip,mode,label,want,expect] of CASES){
  const got=await run(clip,mode);
  const ok=got===expect;
  if(!ok)bad++;
  console.log(label.padEnd(36),want.padEnd(11),(got?'yes':'no').padEnd(6),ok?'PASS':'FAIL');
}
console.log('\n'+(bad?bad+' FAILED':'music behaves like ChatGPT: ignored, and you are still heard over it'));
process.exit(bad?1:0);
