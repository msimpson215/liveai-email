/**
 * The client side of the AI business consultant.
 *
 * Shared by the card page, where the controls are invisible hotspots on Tim's
 * artwork, and by the plain test page, where they are ordinary buttons. Same
 * conversation, same profile, same code - only the shell differs.
 *
 * A page opts into artwork by setting window.SABC_HOTSPOTS before loading this.
 */
(function(){
/* The card page and the plain page use the same ids, so the same code drives
   both. #art and #missing only exist on the card page. */
const art=document.getElementById('art');
const orbHot=document.getElementById('orbHot');
const uploadHot=document.getElementById('uploadHot');
const reviewHot=document.getElementById('reviewHot');
const summaryHot=document.getElementById('summaryHot');   /* only on artwork that has it */
const statusEl=document.getElementById('status');
const rowEl=document.getElementById('row');
const docInput=document.getElementById('docInput');
const profileInput=document.getElementById('profileInput');

/* On the card page the controls sit on top of the artwork, positioned as
   percentages of the image so they hold at every screen size. The plain page
   sets no hotspots and its buttons are just buttons. */
function place(el,box){
  if(!el||!box)return;
  el.style.left=box.left+'%';
  el.style.top=box.top+'%';
  el.style.width=box.width+'%';
  if(box.height)el.style.height=box.height+'%';
}
const HOTSPOTS=window.SABC_HOTSPOTS||null;
if(HOTSPOTS){
  place(orbHot,HOTSPOTS.orb);
  place(uploadHot,HOTSPOTS.upload);
  place(reviewHot,HOTSPOTS.review);
  place(summaryHot,HOTSPOTS.summary);
  /* A control with nothing drawn under it must not be clickable. */
  if(summaryHot&&!HOTSPOTS.summary)summaryHot.style.display='none';
  if(/[?&]tune=1/.test(location.search)){
    [orbHot,uploadHot,reviewHot,summaryHot].forEach(function(el){
      if(!el||el.style.display==='none')return;
      el.style.outline='2px dashed #f4681f';
      el.style.background='rgba(244,104,31,.18)';
    });
  }
}

/* No artwork on the server means no page - it is never stood in for. */
function artMissing(){ document.body.classList.add('noart'); }
if(art){
  art.addEventListener('error',artMissing);
  /* The image can finish loading - or fail - before this script runs. */
  if(art.complete&&!art.naturalWidth)artMissing();
}

/* ---- who they are: one code, kept on the device, nothing else ---- */
const CODE_KEY='sabcCode';
function newCode(){
  const pool='abcdefghjkmnpqrstuvwxyz23456789';
  let out='';
  for(let i=0;i<9;i++)out+=(i===4)?'-':pool[Math.floor(Math.random()*pool.length)];
  return out;
}
let CODE=(function(){
  let c='';
  try{c=localStorage.getItem(CODE_KEY)||''}catch(e){}
  if(!c){ c=newCode(); try{localStorage.setItem(CODE_KEY,c)}catch(e){} }
  return c;
})();

function say(html,bad){ statusEl.className='status'+(bad?' bad':''); statusEl.innerHTML=html; }
function setState(s){ document.body.dataset.state=s; }
function turns(){ return (window.AxonVoice&&AxonVoice.history)?AxonVoice.history():[]; }
function hasTalked(){ return turns().filter(function(t){return t.text.length>8}).length>=2; }

async function refresh(){
  try{
    const r=await fetch('/api/sabc/profile?code='+encodeURIComponent(CODE),{cache:'no-store'});
    const d=await r.json();
    const bits=[];
    if(d.answered)bits.push(d.answered+' of '+d.total+' covered');
    if(d.docs)bits.push(d.docs+(d.docs===1?' document':' documents'));
    if(d.sessions)bits.push(d.sessions+(d.sessions===1?' conversation':' conversations'));
    rowEl.innerHTML='Your private code <code>'+CODE+'</code>'+(bits.length?' \u00B7 '+bits.join(' \u00B7 '):'')+
      '<br><button type="button" id="dlBtn">Download my business profile</button> \u00B7 '+
      '<button type="button" id="upBtn">Load a profile</button> \u00B7 '+
      '<button type="button" id="codeBtn">Use a different code</button> \u00B7 '+
      '<button type="button" id="wipeBtn">Erase everything</button>';
    document.getElementById('dlBtn').addEventListener('click',function(){
      location.href='/api/sabc/profile?download=1&code='+encodeURIComponent(CODE);
    });
    document.getElementById('upBtn').addEventListener('click',function(){profileInput.click()});
    document.getElementById('codeBtn').addEventListener('click',changeCode);
    document.getElementById('wipeBtn').addEventListener('click',wipe);
  }catch(e){}
}

function changeCode(){
  const next=(prompt('Enter the code from before, to pick up where you left off:',CODE)||'').trim().toLowerCase();
  if(!next)return;
  if(next.replace(/[^a-z0-9]/g,'').length<4){ say('That code is too short \u2014 four characters or more.',true); return; }
  CODE=next;
  try{localStorage.setItem(CODE_KEY,CODE)}catch(e){}
  say('Using code '+CODE+'. Everything saved under it is back.');
  refresh();
}

async function wipe(){
  if(!confirm('Erase your whole business profile, documents and reviews under code '+CODE+'? This cannot be undone.'))return;
  try{
    await fetch('/api/founder/forget',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:CODE})});
    say('Erased. Nothing is kept under that code any more.');
  }catch(e){ say('Could not erase that just now.',true); }
  refresh();
}

/* ---- the conversation ---- */
let pc=null,localStream=null,starting=false,audioEl=null,voice=null,filed=false;

function ensureAudio(){
  if(!audioEl){audioEl=document.createElement('audio');audioEl.autoplay=true;audioEl.playsInline=true;document.body.appendChild(audioEl);}
  return audioEl;
}
function resumeAudio(){ if(audioEl&&audioEl.paused){audioEl.play().catch(function(){});return true;} return false; }

/* When a session ends the transcript goes to the server, which works out which
   of Tim's questions it answered. That is what makes next time continue. */
function fileSession(){
  if(filed||!hasTalked())return;
  filed=true;
  try{
    fetch('/api/sabc/track',{method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:CODE,turns:turns()})}).then(refresh).catch(function(){});
  }catch(e){}
}

/* A twenty minute conversation should not depend on the browser closing
   politely. While the call is live, file what has been said so far every couple
   of minutes - without a session summary, so the history stays one entry. */
let interimAt=0;
setInterval(function(){
  if(!pc||filed||!hasTalked())return;
  const count=turns().length;
  if(count<=interimAt+4)return;          /* nothing much new to file */
  interimAt=count;
  try{
    fetch('/api/sabc/track',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:CODE,turns:turns(),interim:true})}).then(refresh).catch(function(){});
  }catch(e){}
},120000);

async function stopVoice(){
  fileSession();
  if(voice){voice.detach();voice=null}
  if(pc){try{pc.close()}catch(e){}pc=null}
  if(localStream){try{localStream.getTracks().forEach(function(t){t.stop()})}catch(e){}localStream=null}
  starting=false;
  setState('idle');
  say('Paused. Tap the orb whenever you want to carry on \u2014 I\u2019ll remember where we were.');
}

let reconnecting=false,tries=0;
async function handleLost(){
  if(reconnecting)return;
  reconnecting=true;
  setState('connecting'); say('Reconnecting\u2026');
  try{if(voice){voice.detach();voice=null}}catch(e){}
  try{if(pc)pc.close()}catch(e){}
  pc=null;
  if(localStream){try{localStream.getTracks().forEach(function(t){t.stop()})}catch(e){}localStream=null}
  const wait=Math.min(8000,600*Math.pow(2,tries++));
  setTimeout(async function(){
    try{await connect();tries=0;}
    catch(e){ if(tries<5){reconnecting=false;handleLost();return;} }
    reconnecting=false;
  },wait);
}

async function connect(){
  const r=await fetch('/session?gate=1&src=sabc&code='+encodeURIComponent(CODE),{cache:'no-store'});
  const data=await r.json();
  if(!r.ok||data.error){const err=new Error(data.error||'session');err.status=r.status;throw err;}
  const key=data.value||(data.client_secret&&data.client_secret.value);
  if(!key)throw new Error('no token');

  pc=new RTCPeerConnection();
  const audio=ensureAudio();
  let remoteStream=null;
  pc.ontrack=function(e){
    remoteStream=e.streams[0];
    if(audio.srcObject!==e.streams[0]){audio.srcObject=e.streams[0];audio.play().catch(function(){});}
  };
  localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  const micTrack=localStream.getAudioTracks()[0];
  micTrack.enabled=false;                 /* the opening cannot be interrupted */
  pc.addTrack(micTrack);

  const dc=pc.createDataChannel('oai-events');
  dc.addEventListener('open',function(){
    if(AxonVoice.hasHistory())return;     /* a dropped call resuming */
    try{dc.send(JSON.stringify({type:'response.create'}));}catch(e){}
  });
  dc.addEventListener('message',function(ev){
    try{
      const m=JSON.parse(ev.data);
      if(m.type==='response.created'){setState('speaking');}
      if(m.type==='response.done'){setState('listening');say('Listening \u2014 take your time.');}
    }catch(e){}
  });

  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  const sdp=await fetch('https://api.openai.com/v1/realtime/calls',{
    method:'POST',body:offer.sdp,
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/sdp'}
  });
  if(!sdp.ok)throw new Error('sdp');
  await pc.setRemoteDescription({type:'answer',sdp:await sdp.text()});
  voice=AxonVoice.attach({dc:dc,micTrack:micTrack,localStream:localStream,remoteStream:remoteStream,
    voice:data.voice,pc:pc,onLost:handleLost});
  setState('listening');
}

async function toggle(){
  if(starting)return;
  if(pc){ if(!resumeAudio())await stopVoice(); return; }
  starting=true; filed=false; interimAt=0;
  setState('connecting'); say('One moment\u2026');
  try{ await connect(); }
  catch(e){
    await stopVoice();
    say(e.status===429?'The line is busy right now \u2014 try again in a minute.':'I could not start the conversation. Check the microphone permission and try again.',true);
  }
  starting=false;
}

orbHot.addEventListener('click',toggle);
document.addEventListener('keydown',function(e){if(e.key==='Escape')stopVoice()});
window.addEventListener('pagehide',fileSession);
document.addEventListener('visibilitychange',function(){if(document.hidden)fileSession()});

/* ---- upload documents ---- */
uploadHot.addEventListener('click',function(){docInput.click()});
docInput.addEventListener('change',async function(){
  const file=docInput.files[0];
  if(!file)return;
  say('Reading '+file.name+'\u2026');
  const body=new FormData();
  body.append('code',CODE);
  body.append('file',file);
  try{
    const r=await fetch('/api/founder/doc',{method:'POST',body:body});
    const d=await r.json();
    if(!d.ok)throw new Error(d.error||'upload failed');
    let note='Read <b>'+d.name+'</b>. It\u2019s part of your business profile now.';
    if(d.noticed&&d.noticed.length)note+='<br>Something to look at: '+d.noticed[0];
    say(note);
  }catch(e){ say(e.message||'I could not read that file.',true); }
  docInput.value='';
  refresh();
});

/* ---- load a profile from a file ---- */
profileInput.addEventListener('change',async function(){
  const file=profileInput.files[0];
  if(!file)return;
  say('Loading your profile\u2026');
  const body=new FormData();
  body.append('code',CODE);
  body.append('file',file);
  try{
    const r=await fetch('/api/sabc/profile/import',{method:'POST',body:body});
    const d=await r.json();
    if(!d.ok)throw new Error(d.error||'import failed');
    say('Loaded. '+d.answered+' of '+d.total+' questions already answered \u2014 tap the orb and we\u2019ll carry on.');
  }catch(e){ say(e.message||'That file could not be read as a business profile.',true); }
  profileInput.value='';
  refresh();
});

/* ---- download summary: what this conversation covered, to keep ----
   Distinct from the business review, which analyses the whole profile. This is
   the shorter "here is where you are and what to do next" write-up. */
if(summaryHot)summaryHot.addEventListener('click',async function(){
  if(!hasTalked()){ say('Talk with me for a minute first, then I can write it up.',true); return; }
  say('Writing your summary\u2026');
  summaryHot.disabled=true;
  try{
    const r=await fetch('/api/founder/summary',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:CODE,turns:turns()})});
    const d=await r.json();
    if(!d.ok)throw new Error(d.error||'summary failed');
    say('Your summary is ready \u2014 <a href="'+d.url+'" download>download the PDF</a>.');
  }catch(e){ say(e.message||'I could not write that up just now.',true); }
  summaryHot.disabled=false;
  refresh();
});

/* ---- my business review ---- */
reviewHot.addEventListener('click',async function(){
  say('Writing your business review\u2026 this takes a few seconds.');
  reviewHot.disabled=true;
  try{
    const r=await fetch('/api/sabc/review',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:CODE,turns:turns()})});
    const d=await r.json();
    if(!d.ok)throw new Error(d.error||'review failed');
    say('Your business review is ready \u2014 <a href="'+d.url+'" download>download the PDF</a>.');
  }catch(e){ say(e.message||'I could not build the review just now.',true); }
  reviewHot.disabled=false;
  refresh();
});

refresh();
if(/[?&]do=upload/.test(location.search))docInput.click();
if(/[?&]do=review/.test(location.search))reviewHot.click();
})();
