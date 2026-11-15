/* Inline Axon voice orb for /sites/* concept websites.
   Keeps visitors right inside each site's own branding and colors. */
(function () {
  var sessionUrl = document.body.getAttribute('data-session');
  if (!sessionUrl) return;

  var orb = document.querySelector('.orb');
  var statusEl = document.querySelector('.status');
  var btn = document.getElementById('talkBtn');
  var idleLabel = btn ? btn.textContent : 'Start talking';

  var LABELS = {
    idle: 'Tap the orb or button to talk · sound on',
    connecting: 'Connecting voice…',
    active: 'Listening — go ahead and ask your question',
    error: 'Could not start microphone — allow mic access and tap again'
  };

  var pc = null, localStream = null, micTrack = null, dc = null, voice = null;
  var starting = false, audioEl = null;
  var reconnecting = false, reconnectTries = 0;

  function setState(s) {
    document.body.classList.remove('voice-idle', 'voice-connecting', 'voice-active', 'voice-error');
    document.body.classList.add('voice-' + s);
    if (statusEl) statusEl.textContent = LABELS[s] || '';
    if (btn) {
      btn.textContent = (s === 'active' || s === 'connecting') ? 'Stop conversation' : idleLabel;
    }
  }

  function ensureAudio() {
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
    }
    return audioEl;
  }

  function resumeAudio() {
    if (audioEl && audioEl.paused) {
      audioEl.play().catch(function () {});
      return true;
    }
    return false;
  }

  function stop() {
    if (voice) { try { voice.detach(); } catch (e) {} voice = null; }
    if (pc) { try { pc.close(); } catch (e) {} pc = null; }
    if (localStream) {
      try { localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      localStream = null;
    }
    dc = null; micTrack = null; starting = false;
    setState('idle');
  }

  function handleLost() {
    if (reconnecting) return;
    reconnecting = true;
    try { if (voice) { voice.detach(); voice = null; } } catch (e) {}
    try { if (pc) pc.close(); } catch (e) {}
    pc = null;
    if (localStream) {
      try { localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      localStream = null;
    }
    var wait = Math.min(8000, 600 * Math.pow(2, reconnectTries++));
    setTimeout(function () {
      connectVoice().then(function () { reconnectTries = 0; }).catch(function () {
        if (reconnectTries < 5) handleLost();
      }).finally(function () { reconnecting = false; });
    }, wait);
  }

  async function connectVoice() {
    var r = await fetch(sessionUrl, { cache: 'no-store' });
    var data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'session');
    var key = data.value || (data.client_secret && data.client_secret.value);
    if (!key) throw new Error('no token');
    pc = new RTCPeerConnection();
    var audio = ensureAudio();
    var remoteStream = null;
    pc.ontrack = function (e) {
      remoteStream = e.streams[0];
      if (audio.srcObject !== e.streams[0]) {
        audio.srcObject = e.streams[0];
        audio.play().catch(function () {});
      }
    };
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    micTrack = localStream.getAudioTracks()[0];
    micTrack.enabled = false;
    pc.addTrack(micTrack);
    dc = pc.createDataChannel('oai-events');
    dc.addEventListener('open', function () {
      if (window.AxonVoice && AxonVoice.hasHistory && AxonVoice.hasHistory()) return;
      try { dc.send(JSON.stringify({ type: 'response.create' })); } catch (e) {}
    });
    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    var sdp = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/sdp' }
    });
    if (!sdp.ok) throw new Error('sdp');
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
    if (window.AxonVoice && AxonVoice.attach) {
      voice = AxonVoice.attach({
        dc: dc, micTrack: micTrack, localStream: localStream,
        remoteStream: remoteStream, voice: data.voice, pc: pc, onLost: handleLost
      });
    } else {
      micTrack.enabled = true;
    }
    setState('active');
  }

  async function start() {
    if (pc || starting) return;
    starting = true;
    setState('connecting');
    try { await connectVoice(); }
    catch (e) { console.error(e); stop(); setState('error'); }
    starting = false;
  }

  function toggle(e) {
    if (e) e.preventDefault();
    if (pc || starting) {
      if (!resumeAudio()) stop();
    } else {
      start();
    }
  }

  if (orb) {
    orb.style.cursor = 'pointer';
    orb.setAttribute('role', 'button');
    orb.setAttribute('tabindex', '0');
    orb.addEventListener('click', toggle);
    orb.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
    });
  }
  if (btn) btn.addEventListener('click', toggle);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') stop(); });
  window.addEventListener('pagehide', function () { if (pc || starting) stop(); });
  window.addEventListener('beforeunload', function () { if (pc || starting) stop(); });
  setState('idle');
})();
