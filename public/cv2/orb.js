/* Axon orb, in page.

   Axon never sends anyone off the host site to talk. The orb sits in the upper
   right, pulsating, and opens the voice session right where it stands. Every
   talk button and every suggested question calls the same orb — nothing
   navigates. */

(function () {
  var SRC = 'marty';
  var tier = (new URLSearchParams(location.search).get('tier') || '').toLowerCase();
  var sessionUrl = '/session?gate=1&src=' + encodeURIComponent(SRC) + (tier ? '&tier=' + encodeURIComponent(tier) : '');

  var STATUS = {
    idle: 'Tap to talk with Marty’s AI team member',
    connecting: 'Connecting…',
    active: 'Listening — ask about Marty',
    error: 'That didn’t connect. Tap to try again.'
  };

  var host = document.createElement('div');
  host.className = 'axon-orb-dock';
  host.innerHTML =
    '<button id="axonOrb" type="button" aria-label="Talk with Marty’s AI team member">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 3a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 1 0 7 0v-5A3.5 3.5 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5M8.5 20.5h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>' +
    '</button>' +
    '<p class="axon-orb-status" role="status" aria-live="polite"></p>';
  document.body.appendChild(host);

  var orb = host.querySelector('#axonOrb');
  var statusEl = host.querySelector('.axon-orb-status');

  var pc = null, localStream = null, micTrack = null, dc = null, voice = null;
  var starting = false, audioEl = null;
  var reconnecting = false, reconnectTries = 0;

  function setState(s) {
    document.body.classList.remove('axon-idle', 'axon-connecting', 'axon-active', 'axon-error');
    document.body.classList.add('axon-' + s);
    statusEl.textContent = STATUS[s] || '';
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
    if (audioEl && audioEl.paused) { audioEl.play().catch(function () {}); return true; }
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
      connectVoice()
        .then(function () { reconnectTries = 0; })
        .catch(function () { if (reconnectTries < 5) handleLost(); })
        .then(function () { reconnecting = false; });
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
      if (window.AxonVoice && AxonVoice.hasHistory()) return;
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

    voice = AxonVoice.attach({
      dc: dc, micTrack: micTrack, localStream: localStream,
      remoteStream: remoteStream, voice: data.voice, pc: pc, onLost: handleLost
    });
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

  function toggle() {
    if (pc || starting) { if (!resumeAudio()) stop(); }
    else { start(); }
  }

  /* Open the orb, and once the line is live, put the question in for them so a
     tapped suggestion goes straight to an answer. */
  function ask(question) {
    function send() {
      if (!dc || dc.readyState !== 'open') return false;
      try {
        dc.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message', role: 'user',
            content: [{ type: 'input_text', text: question }]
          }
        }));
        dc.send(JSON.stringify({ type: 'response.create' }));
        return true;
      } catch (e) { return false; }
    }
    if (send()) return;
    start().then(function () {
      var tries = 0;
      var t = setInterval(function () {
        if (send() || ++tries > 40) clearInterval(t);
      }, 250);
    });
  }

  orb.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });

  /* Anything that used to navigate to the talk page now opens the orb here. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="talk.html"]');
    if (!a) return;
    e.preventDefault();
    var q = a.getAttribute('data-ask');
    if (q) ask(q); else toggle();
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') stop(); });
  window.addEventListener('pagehide', function () { if (pc || starting) stop(); });
  window.addEventListener('beforeunload', function () { if (pc || starting) stop(); });

  setState('idle');
  window.AxonOrb = { toggle: toggle, ask: ask, stop: stop };
})();
