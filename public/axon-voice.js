/* Axon voice turn-taking — ONE implementation for every orb on the site.
   Include it, then call AxonVoice.attach(...) once the call is up.

   What it fixes, and why any of this exists:

   Left alone, the Realtime API answers whatever the microphone commits. A gust,
   a cough, a slammed door or a passing truck gets committed as the caller's
   turn, and since there are no words in it the model falls back to its opening
   line — that is the "Hello, how can I help you today?" restart. It will also
   cancel a reply mid-sentence on the same noise.

   So the page has to decide for itself when a person is talking. Every 50ms it
   splits the sound into rumble (below 150Hz) and voice (150Hz-3kHz). Those
   numbers were measured by playing real recordings through this exact code in a
   real browser. Rumble measured against the speech band:

       engine 30x    wind 8.6x    thump/fart 2.1x    a person 0.05x

   A person is the one sound with almost no rumble underneath it.

   The result behaves the way people expect from the ChatGPT app: talk over it
   and it stops; cough, bump the table or stand in the wind and it does not. */
(function (global) {
  'use strict';

  var FRAME_MS = 50;

  /* What has been said so far, kept on the page rather than inside the session.
     A WebRTC call can drop for a hundred boring reasons — a phone switching from
     wifi to cellular, a tunnel, a laptop sleeping. The session on OpenAI's side
     dies with it and takes the whole conversation with it. Holding the last few
     turns here means a reconnect can hand them back, so it carries on instead of
     greeting you again like it has never met you. */
  var HISTORY = [];
  var HISTORY_MAX = 14;

  function remember(role, text) {
    var t = String(text || '').trim();
    if (!t) return;
    HISTORY.push({ role: role, text: t.slice(0, 600) });
    if (HISTORY.length > HISTORY_MAX) HISTORY.splice(0, HISTORY.length - HISTORY_MAX);
  }
  var JUNK_TURNS = {};
  ['', 'you', 'thank you', 'thanks', 'thank you very much', 'thanks for watching',
    'bye', 'goodbye', 'silence', 'music', 'uh', 'um', 'uhh', 'hmm', 'mm', 'mhm',
    'ah', 'oh', 'huh', 'so', 'the', 'a', 'i'].forEach(function (w) { JUNK_TURNS[w] = true; });

  function normTurn(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function attach(opts) {
    var dc = opts.dc;
    var micTrack = opts.micTrack;
    var localStream = opts.localStream;
    var remoteStream = opts.remoteStream;
    var blocked = opts.blocked || function () { return false; };
    var allowBargeIn = opts.allowBargeIn !== false;
    var onAiSpeaking = opts.onAiSpeaking || function () {};
    var greetingFirst = opts.greetingFirst !== false;
    var voice = opts.voice || 'coral';
    var pc = opts.pc || null;
    var onLost = opts.onLost || function () {};
    var onNoisyRoom = opts.onNoisyRoom || function () {};

    var audioCtx = null, roomAnalyser = null, aiAnalyser = null;
    var freqData = null, timeData = null, aiData = null;
    var analyserTrack = null, timer = null, aiTimer = null;

    var aiSpeaking = greetingFirst;      // the opening is playing, mic stays shut
    var greetingDone = !greetingFirst;
    var lastAiSound = Date.now(), bargeUntil = 0;
    var voiceFloor = 1e-7, voiceRun = 0, quietRun = 0, turnVoiceMs = 0;
    var aiFrames = 0, aiVoiceFrames = 0, wasAiSpeaking = false;
    var responseActive = false, turnPending = false, turnTimer = null;
    var speechStartedAt = 0, lastTurnMs = 0;
    var bargeEnabled = true, badBarge = 0, bargeWatch = null;
    var stuckTimer = null, hurried = false;
    /* Tap-to-talk. The mic is shut unless the caller is holding the floor.
       This is the only thing that reliably works in a room with a television
       or a radio going: a TV's voice and a person's voice measure the same
       through one microphone, so the only way to not hear the TV is to have
       the microphone closed. */
    /* What the caller has actually HEARD of the current reply. Without telling
       the service this, it still believes the whole reply was delivered, so the
       next turn re-delivers it from the top — the "it starts over from the
       beginning" that ruins the illusion of a person. conversation.item.truncate
       is the API's mechanism for exactly this and it was never being used. */
    var liveItemId = null, itemAudioStart = 0, resumeTimer = null;
    var pttMode = false, holding = false;
    var roomVoiceFrames = 0, roomFrames = 0, noisyTold = false;
    /* True when the room itself keeps producing speech — a television, a radio,
       people talking nearby. Only then is it worth asking whether a turn was
       actually addressed to us, because that check costs a moment and a quiet
       room should never pay it. */
    var roomTalkative = false;
    var detached = false;

    /* Backgrounding the page used to tear the whole call down, so glancing at a
       notification meant reloading to get going again. Now it just closes the
       mic and the call stays up. */
    var backgrounded = false;
    function onVisibility() {
      backgrounded = (global.document && global.document.hidden) || false;
      refreshMic();
    }
    if (global.document && global.document.addEventListener) {
      global.document.addEventListener('visibilitychange', onVisibility);
    }

    function refreshMic() {
      if (!micTrack) return;
      try {
        micTrack.enabled = backgrounded ? false : (pttMode
          ? (holding && !blocked())
          : !(aiSpeaking || blocked()));
      } catch (e) {}
    }

    function send(obj) {
      try { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)); } catch (e) {}
    }

    /* Ask the service to make its mind up faster about when a turn has ended.
       The whole audio block is resent, including the output voice: a partial
       session.update drops settings it does not mention, and losing the voice
       mid-call makes Axon change who it sounds like. */
    function hurryUp() {
      stuckTimer = null;
      if (hurried) return;
      hurried = true;
      send({ type: 'session.update', session: { type: 'realtime', audio: {
        input: {
          noise_reduction: { type: 'far_field' },
          transcription: { model: 'gpt-4o-mini-transcribe' },
          turn_detection: { type: 'semantic_vad', eagerness: 'high',
            interrupt_response: false, create_response: false }
        },
        output: { voice: voice }
      } } });
    }

    /* ---- turn gating: only ever answer a real person ---- */
    function clearTurnTimer() { if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; } }
    function dropTurn() { turnPending = false; clearTurnTimer(); }

    function askForReply() {
      clearTurnTimer();
      turnPending = false;
      // A real turn followed, so any barge-in that led here was a good call.
      if (bargeWatch) { clearTimeout(bargeWatch); bargeWatch = null; }
      if (responseActive || aiSpeaking) return;
      send({ type: 'response.create' });
    }

    /* Did a person say something?

       Our own detector is good but it is NOT allowed the final word. In a loud
       room — music playing, speaker cranked — it can miss a person completely,
       and if it could veto the transcript it would lock the caller out: the orb
       sits there saying "listening" while they repeat themselves. That is worse
       than the bug it was meant to fix. So real transcribed words always win,
       and our own ears only break the tie on the borderline cases. */
    /* Ask the server whether those words were addressed to an assistant or just
       overheard from the room. Fails OPEN — any error, any timeout, and we
       answer. Being talked over by a TV is annoying; being ignored while you are
       actually speaking is what makes the thing unusable. */
    function checkAddressed(transcript) {
      var text = String(transcript || '');
      var settled = false;
      var give = setTimeout(function () {
        if (settled) return;
        settled = true;
        remember('user', text);
        askForReply();
      }, 1800);
      try {
        global.fetch('/api/addressed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (settled) return;
          settled = true;
          clearTimeout(give);
          if (d && d.addressed === false) { dropTurn(); return; }
          remember('user', text);
          askForReply();
        }).catch(function () {
          if (settled) return;
          settled = true;
          clearTimeout(give);
          remember('user', text);
          askForReply();
        });
      } catch (e) {
        if (!settled) { settled = true; clearTimeout(give); remember('user', text); askForReply(); }
      }
    }

    function isRealSpeech(transcript, ms) {
      var s = normTurn(transcript);
      if (!s) return false;
      if (ms < 320) return false;
      // Held the button and spoke: that is intent. Nothing to second-guess,
      // and no way for a loud room to lock them out.
      if (pttMode) return /[a-z0-9]/.test(s);
      var heard = roomAnalyser ? turnVoiceMs : 999;
      // What the transcriber guesses at noise. A fart comes back as "you".
      if (JUNK_TURNS[s]) return heard >= 600;
      // Two or more real words is a person, whatever our detector thought.
      if (s.split(' ').length >= 2) return true;
      // One word could be "yes", or could be a thump. Needs corroboration.
      return heard >= 150;
    }

    function handleEvent(ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      var t = msg.type || '';
      if (t === 'response.output_item.added' && msg.item && msg.item.id) {
        liveItemId = msg.item.id;
        itemAudioStart = 0;
      }
      /* Audio itself travels on the media track, not through here, so there is
         no audio delta to time from. These two are what the service actually
         sends when a reply starts coming out of the speaker. */
      if (t === 'output_audio_buffer.started' && !itemAudioStart) itemAudioStart = Date.now();
      if (t === 'response.output_audio_transcript.delta') {
        if (msg.item_id) liveItemId = msg.item_id;
        if (!itemAudioStart) itemAudioStart = Date.now();
      }
      if (t === 'response.audio_transcript.done' || t === 'response.output_audio_transcript.done') {
        remember('assistant', msg.transcript);
      }
      if (t === 'response.created') responseActive = true;
      else if (t === 'response.done') {
        responseActive = false;
        greetingDone = true;
        liveItemId = null;
        itemAudioStart = 0;
      } else if (t === 'input_audio_buffer.speech_started') {
        speechStartedAt = Date.now();
        turnVoiceMs = 0;
        dropTurn();                       // a new turn supersedes the old one
        /* In a loud room the service can take 15+ seconds to decide the caller
           has finished, because it is waiting for a gap that never comes. That
           is what leaves the orb sitting there saying "listening" while someone
           repeats themselves. If a turn runs long, tell it to be quicker. */
        if (stuckTimer) clearTimeout(stuckTimer);
        stuckTimer = setTimeout(hurryUp, 3000);
      } else if (t === 'input_audio_buffer.speech_stopped') {
        if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
        lastTurnMs = speechStartedAt ? (Date.now() - speechStartedAt) : 0;
        turnPending = true;
        clearTurnTimer();
        /* We already heard a person during that turn — answer straight away
           rather than waiting on a transcript. Waiting is only for the
           borderline cases. */
        /* Our own ears cannot tell a television from a person, so in a room
           that is already talking we do not trust them — we wait for the words
           and check whether they were meant for us. */
        if (turnVoiceMs >= 350 && !roomTalkative) askForReply();
        else {
          /* Nothing conclusive heard. Wait for the transcript. If it is slow we
             answer anyway on our own evidence, but we do NOT give up on the
             turn — a late transcript must still be able to get a reply, or a
             slow network becomes another way to lock the caller out. */
          turnTimer = setTimeout(function () {
            if (turnPending && turnVoiceMs >= 150 && lastTurnMs >= 700) askForReply();
          }, 2500);
        }
      } else if (t === 'conversation.item.input_audio_transcription.completed') {
        if (turnPending) {
          if (!isRealSpeech(msg.transcript, lastTurnMs)) dropTurn();
          else if (pttMode || !roomTalkative) {
            remember('user', msg.transcript);
            askForReply();
          } else {
            // Room is talking to itself. Was that meant for us?
            checkAddressed(msg.transcript);
          }
        }
      } else if (t === 'conversation.item.input_audio_transcription.failed') {
        if (turnPending) {
          if (turnVoiceMs >= 150 && lastTurnMs >= 700) askForReply(); else dropTurn();
        }
      }
    }

    /* ---- is a person talking right now? ---- */
    function bandEnergy() {
      roomAnalyser.getByteFrequencyData(freqData);
      var hzPerBin = (audioCtx.sampleRate / 2) / freqData.length;
      var low = 1e-12, voice = 1e-12;
      for (var i = 1; i < freqData.length; i++) {
        var hz = i * hzPerBin;
        if (hz > 3000) break;
        // The analyser reports dB; convert back to real energy or near-silent
        // bins count as much as loud ones and every sound scores the same.
        var e = Math.pow(10, ((freqData[i] / 255) * 70 - 100) / 10);
        if (hz < 150) low += e; else voice += e;
      }
      return { low: low, voice: voice };
    }

    /* Tell the service how much of the reply was actually heard, so its record
       matches the caller's memory. Everything after this point is forgotten by
       both sides, which is what lets it carry on instead of starting again. */
    function truncateHere() {
      if (!liveItemId || !itemAudioStart) return;
      var heardMs = Math.max(0, Date.now() - itemAudioStart);
      send({ type: 'conversation.item.truncate', item_id: liveItemId,
        content_index: 0, audio_end_ms: heardMs });
    }

    function bargeIn() {
      voiceRun = 0;
      if (!aiSpeaking) return;
      truncateHere();
      // Only cancel something that is actually being generated. The speaker can
      // still be draining audio after a reply finished, and cancelling then
      // just makes the service complain.
      if (responseActive) send({ type: 'response.cancel' });
      bargeUntil = Date.now() + 1000;
      aiSpeaking = false;
      responseActive = false;
      refreshMic();
      onAiSpeaking(false);
      /* Watch what follows. A real interruption is followed by the caller
         actually saying something. If nothing does, we cut it off over nothing —
         so rather than leaving a half sentence hanging, it apologises and picks
         up where it stopped. That is what a person would do. */
      if (bargeWatch) clearTimeout(bargeWatch);
      bargeWatch = setTimeout(function () {
        bargeWatch = null;
        badBarge++;
        if (badBarge >= 2) bargeEnabled = false;   // clearly misreading this room
        resumeAfterFalseInterruption();
      }, 2600);
    }

    /* Nobody actually spoke — the room did. Say so, briefly and politely, and
       carry on from the exact point it stopped. */
    function resumeAfterFalseInterruption(tries) {
      tries = tries || 0;
      if (detached || tries > 25) return;   // ~18s; audio can take a while to drain
      if (!dc || dc.readyState !== 'open') return;
      /* The speaker may still be draining the cancelled reply, and the caller
         may yet turn out to have really spoken. Wait our turn rather than
         giving up, which is what left a half sentence hanging. */
      if (responseActive || aiSpeaking || turnPending) {
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function () { resumeAfterFalseInterruption(tries + 1); }, 700);
        return;
      }
      var line = roomTalkative
        ? 'You were cut off by background noise, not by the caller. Begin with one short apology, close to these words: "Sorry — I thought I heard you there." Then carry straight on from the exact word you stopped at, mid-sentence if that is where it was. Do not start the answer again, do not summarise what you already said, and do not greet them. If it has happened more than once you may add one gentle sentence, such as suggesting somewhere quieter or turning the volume down a little.'
        : 'You were cut off by a noise, not by the caller. Begin with one short apology, close to these words: "Sorry — I thought I heard you there." Then carry straight on from the exact word you stopped at. Do not start the answer again and do not repeat what you already said.';
      send({ type: 'response.create', response: { instructions: line } });
    }

    function checkRoom() {
      if (!roomAnalyser || detached) return;
      var b = bandEnergy();
      // A person: real energy in the speech band, clearly above this room's own
      // background, with hardly any rumble under it.
      var speechish = b.voice > Math.max(voiceFloor * 3, 1e-7) && (b.low / b.voice) < 0.3;
      if (speechish) { voiceRun += FRAME_MS; quietRun = 0; }
      else {
        quietRun += FRAME_MS;
        if (quietRun >= 200) voiceRun = 0;
        // Learn the background only from frames that are not a person, or the
        // floor creeps up on the caller's own voice until they stop counting.
        if (!aiSpeaking) voiceFloor = Math.min(1e-2, Math.max(1e-9, voiceFloor * 0.9 + b.voice * 0.1));
      }
      if (!aiSpeaking && speechish) turnVoiceMs += FRAME_MS;

      /* A room full of voices, or one person cutting in? Measured only while the
         AI is talking and the mic is shut. A bar hums with voices the whole
         time; a person speaks up after the AI has been going a moment. */
      if (aiSpeaking && !wasAiSpeaking) { aiFrames = 0; aiVoiceFrames = 0; }
      wasAiSpeaking = aiSpeaking;
      if (aiSpeaking) { aiFrames++; if (speechish) aiVoiceFrames++; }
      var crowded = aiFrames > 0 && (aiVoiceFrames / aiFrames) >= 0.7;

      if (allowBargeIn && aiSpeaking && !crowded && bargeEnabled && greetingDone &&
          !blocked() && aiFrames >= 20 && voiceRun >= 500) bargeIn();

      /* Is this room talking by itself? Measured while the AI is quiet and the
         caller has not been given the floor. A room that reads as voices most of
         the time is a television or a crowd, and hands-free cannot win there. */
      if (!pttMode && !aiSpeaking && !blocked()) {
        roomFrames++;
        if (speechish) roomVoiceFrames++;
        if (roomFrames >= 100) {                       // ~5 seconds of evidence
          var share = roomVoiceFrames / roomFrames;
          roomTalkative = share > 0.35;
          if (!noisyTold && share > 0.55) {
            noisyTold = true;
            try { onNoisyRoom(); } catch (e) {}
          }
          roomFrames = 0; roomVoiceFrames = 0;
        }
      }
    }

    /* ---- is the AI making sound right now? ---- */
    function checkAi() {
      if (!aiAnalyser || detached) return;
      aiAnalyser.getByteTimeDomainData(aiData);
      var sum = 0;
      for (var i = 0; i < aiData.length; i++) { var v = (aiData[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / aiData.length);
      var now = Date.now();
      // Just after a barge-in the cancelled reply is still draining out of the
      // speaker. Ignore it, or it looks like the AI started talking again and
      // slams the mic shut on the caller mid-sentence.
      if (now < bargeUntil) {
        if (aiSpeaking) { aiSpeaking = false; refreshMic(); onAiSpeaking(false); }
        return;
      }
      if (rms > 0.025) {
        lastAiSound = now;
        if (!aiSpeaking) { aiSpeaking = true; refreshMic(); onAiSpeaking(true); }
      } else if (aiSpeaking && (now - lastAiSound) > 700) {
        aiSpeaking = false; refreshMic(); onAiSpeaking(false);
      }
    }

    try {
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
      /* An always-live copy of the mic feeds the detector, so the real mic can
         be shut while the AI talks and we can still hear the room. Clone first,
         while it is still live. */
      try { analyserTrack = micTrack.clone(); analyserTrack.enabled = true; } catch (e) { analyserTrack = null; }
      var roomStream = analyserTrack ? new global.MediaStream([analyserTrack]) : localStream;
      var roomSrc = audioCtx.createMediaStreamSource(roomStream);
      roomAnalyser = audioCtx.createAnalyser();
      roomAnalyser.fftSize = 1024;
      roomAnalyser.smoothingTimeConstant = 0.3;
      freqData = new Uint8Array(roomAnalyser.frequencyBinCount);
      timeData = new Uint8Array(roomAnalyser.fftSize);
      roomSrc.connect(roomAnalyser);
      timer = setInterval(checkRoom, FRAME_MS);

      if (remoteStream) {
        var aiSrc = audioCtx.createMediaStreamSource(remoteStream);
        aiAnalyser = audioCtx.createAnalyser();
        aiAnalyser.fftSize = 512;
        aiData = new Uint8Array(aiAnalyser.frequencyBinCount);
        aiSrc.connect(aiAnalyser);
        aiTimer = setInterval(checkAi, 100);
      }
    } catch (e) {
      // No audio analysis available: fall back to letting the AI always finish.
      roomAnalyser = null;
    }

    if (dc) dc.addEventListener('message', handleEvent);

    /* Hand the previous turns back to a fresh session so it can carry on.
       Without this, a dropped call means it greets you from the top as though
       nothing was ever said. */
    function seedHistory() {
      if (!HISTORY.length) return;
      for (var i = 0; i < HISTORY.length; i++) {
        var h = HISTORY[i];
        send({ type: 'conversation.item.create', item: { type: 'message', role: h.role,
          content: [{ type: h.role === 'assistant' ? 'output_text' : 'input_text', text: h.text }] } });
      }
      send({ type: 'conversation.item.create', item: { type: 'message', role: 'user',
        content: [{ type: 'input_text', text:
          '(The line dropped and reconnected. Do not greet me again and do not start over. ' +
          'Carry on from where we were, briefly.)' }] } });
    }
    if (HISTORY.length) {
      if (dc && dc.readyState === 'open') seedHistory();
      else if (dc) dc.addEventListener('open', seedHistory);
      greetingDone = true;          // no opening on a resumed call
    }

    /* Notice when the call has actually died. Nothing was watching this before,
       so a dropped connection left the orb sitting there looking alive while
       nothing worked, and the only way out was reloading the page. */
    if (pc && typeof pc.addEventListener === 'function') {
      var lost = false;
      var graceTimer = null;
      function declareLost() {
        if (lost || detached) return;
        lost = true;
        try { onLost(); } catch (e) {}
      }
      function checkConn() {
        var s = pc.iceConnectionState;
        if (s === 'failed' || s === 'closed') declareLost();
        else if (s === 'disconnected') {
          // A brief blip often heals itself. Give it a moment before tearing down.
          if (!graceTimer) graceTimer = setTimeout(function () {
            graceTimer = null;
            if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') declareLost();
          }, 4000);
        } else if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
      }
      pc.addEventListener('iceconnectionstatechange', checkConn);
      pc.addEventListener('connectionstatechange', function () {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') declareLost();
      });
      if (dc) dc.addEventListener('close', declareLost);
    }

    refreshMic();

    return {
      refreshMic: refreshMic,
      isAiSpeaking: function () { return aiSpeaking; },
      isPtt: function () { return pttMode; },
      setPtt: function (on) {
        pttMode = !!on;
        holding = false;
        refreshMic();
      },
      /* Called when the caller takes or gives up the floor in tap-to-talk. */
      hold: function (on) {
        if (!pttMode) return;
        holding = !!on;
        if (holding) {
          // Their turn now — stop the reply if one is running.
          if (responseActive) send({ type: 'response.cancel' });
          bargeUntil = Date.now() + 800;
          aiSpeaking = false;
          onAiSpeaking(false);
        }
        refreshMic();
      },
      detach: function () {
        detached = true;
        try { global.document.removeEventListener('visibilitychange', onVisibility); } catch (e) {}
        if (stuckTimer) clearTimeout(stuckTimer);
        if (resumeTimer) clearTimeout(resumeTimer);
        if (timer) clearInterval(timer);
        if (aiTimer) clearInterval(aiTimer);
        if (turnTimer) clearTimeout(turnTimer);
        if (bargeWatch) clearTimeout(bargeWatch);
        if (analyserTrack) { try { analyserTrack.stop(); } catch (e) {} }
        if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
        timer = aiTimer = turnTimer = bargeWatch = null;
        roomAnalyser = aiAnalyser = null;
      }
    };
  }

  global.AxonVoice = {
    attach: attach,
    /* True when there is a conversation to carry over, so a page knows to skip
       the opening line on a reconnect. */
    hasHistory: function () { return HISTORY.length > 0; },
    /* A copy of the turns so far, for pages that save or write up a session. */
    history: function () { return HISTORY.map(function (h) { return { role: h.role, text: h.text }; }); },
    clearHistory: function () { HISTORY.length = 0; }
  };
})(window);
