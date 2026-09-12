/* Captura de voz (grabación + transcripción), medidor de volumen y
   síntesis de voz para Andri. Las grabaciones se persisten en IndexedDB. */
(function (global) {
  'use strict';

  var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  var recordings = [];

  var sessionActive = false;
  var recorder = null;
  var stream = null;
  var chunks = [];
  var recStart = 0;
  var recognition = null;
  var accumulatedText = '';

  var audioCtx = null;
  var analyserNode = null;
  var rafId = null;

  var cb = { onRecording: null, onTranscript: null, onError: null, onLevel: null };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && global.MediaRecorder);
  }

  function srSupported() { return !!SR; }

  function hasIdb() { return typeof global.RecordingStore === 'object' && global.RecordingStore; }

  /* --- Medidor de nivel de voz (barras visuales) --- */
  function startLevelMeter() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      var src = audioCtx.createMediaStreamSource(stream);
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 512;
      src.connect(analyserNode);
      var data = new Uint8Array(analyserNode.fftSize);

      function tick() {
        if (!analyserNode) return;
        analyserNode.getByteTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) {
          var v = (data[i] - 128) / 128;
          sum += v * v;
        }
        var level = Math.sqrt(sum / data.length);
        if (cb.onLevel) cb.onLevel(Math.min(1, level * 3.2));
        rafId = global.requestAnimationFrame(tick);
      }
      rafId = global.requestAnimationFrame(tick);
    } catch (e) {
      stopLevelMeter();
    }
  }

  function stopLevelMeter() {
    if (rafId) { global.cancelAnimationFrame(rafId); rafId = null; }
    if (analyserNode) { try { analyserNode.disconnect(); } catch (e) { /* noop */ } analyserNode = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (e) { /* noop */ } audioCtx = null; }
    if (cb.onLevel) cb.onLevel(0);
  }

  /* --- Reconocimiento (transcripción en vivo) --- */
  function makeRecognition() {
    if (!SR) return null;
    var r = new SR();
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = function (ev) {
      var finalText = '', interimText = '';
      for (var i = 0; i < ev.results.length; i++) {
        var item = ev.results[i];
        if (item.isFinal) finalText += item[0].transcript;
        else interimText += item[0].transcript;
      }
      if (finalText) accumulatedText = finalText.trim();
      if (cb.onTranscript) cb.onTranscript((accumulatedText + ' ' + interimText).trim(), !!finalText);
    };

    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        if (cb.onError) cb.onError('Permiso de micr\u00f3fono denegado o servicio de voz no disponible.');
      }
    };

    r.onend = function () {
      if (sessionActive && recorder && recorder.state === 'recording') {
        try { r.start(); } catch (err) { /* noop */ }
      }
      if (cb.onTranscript) cb.onTranscript(accumulatedText, true);
    };

    return r;
  }

  /* --- Sesión de grabación --- */
  async function startSession() {
    if (sessionActive) return;
    sessionActive = true;
    accumulatedText = '';

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      sessionActive = false;
      stream = null;
      stopLevelMeter();
      throw e;
    }
    recorder = new global.MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = function () {
      var type = recorder && recorder.mimeType ? recorder.mimeType : 'audio/webm';
      var blob = new Blob(chunks, { type: type });
      var rec = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: new Date(),
        createdAt: Date.now(),
        duration: fmtDur(Date.now() - recStart),
        blob: blob,
        transcript: accumulatedText
      };
      recordings.unshift(rec);

      stopLevelMeter();
      if (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
      }
      recorder = null;

      /* persistir (no bloquea la interfaz) */
      if (hasIdb()) {
        global.RecordingStore.put(rec).then(function () {
          return global.RecordingStore.trimToMax();
        }).catch(function () { /* noop */ });
      }

      if (cb.onRecording) cb.onRecording(rec);
    };

    recStart = Date.now();
    recorder.start();
    startLevelMeter();

    recognition = makeRecognition();
    if (recognition) {
      try { recognition.start(); } catch (err) { console.warn('recognition start:', err); }
    }
  }

  function stopSession() {
    if (!sessionActive) return;
    sessionActive = false;
    if (recognition) { try { recognition.stop(); } catch (e) { /* noop */ } }
    if (recorder && recorder.state && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (e) { /* noop */ }
    }
  }

  function isActive() { return sessionActive; }

  /* --- Grabaciones (memoria + IndexedDB) --- */
  function loadStored() {
    if (!hasIdb()) return Promise.resolve();
    return global.RecordingStore.getAll()
      .then(function (list) {
        recordings = list
          .map(function (r) {
            try { r.url = URL.createObjectURL(r.blob); } catch (e) { r.url = null; }
            return r;
          })
          .concat(recordings)
          .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        while (recordings.length > global.RecordingStore.MAX_KEEP) recordings.pop();
      })
      .catch(function () { /* noop */ });
  }

  function getRecordings() { return recordings; }

  function removeRecording(id, revoke) {
    recordings = recordings.filter(function (r) { return r.id !== id; });
    if (hasIdb()) global.RecordingStore.remove(id).catch(function () { /* noop */ });
  }

  function clearRecordings() {
    recordings.forEach(function (r) { if (r.url) URL.revokeObjectURL(r.url); });
    recordings = [];
    if (hasIdb()) global.RecordingStore.clear().catch(function () { /* noop */ });
  }

  function setCallbacks(o) {
    if (o) {
      if (o.onRecording) cb.onRecording = o.onRecording;
      if (o.onTranscript) cb.onTranscript = o.onTranscript;
      if (o.onError) cb.onError = o.onError;
      if (o.onLevel) cb.onLevel = o.onLevel;
    }
  }

  function speak(text, opts) {
    if (!('speechSynthesis' in global)) return;
    opts = opts || {};
    try { global.speechSynthesis.cancel(); } catch (e) { /* noop */ }

    var u = new global.SpeechSynthesisUtterance(text);
    u.lang = opts.lang || 'es-ES';
    u.rate = opts.rate || 1;
    u.pitch = opts.pitch || 1;

    var voices = global.speechSynthesis.getVoices();
    var es = voices.find ? voices.find(function (v) { return /^es/i.test(v.lang); }) : null;
    if (es) u.voice = es;

    if (opts.onEnd) {
      u.onend = opts.onEnd;
      u.onerror = opts.onEnd;
    }
    global.speechSynthesis.speak(u);
  }

  global.Speech = {
    supported: supported,
    srSupported: srSupported,
    startSession: startSession,
    stopSession: stopSession,
    isActive: isActive,
    loadStored: loadStored,
    getRecordings: getRecordings,
    removeRecording: removeRecording,
    clearRecordings: clearRecordings,
    setCallbacks: setCallbacks,
    speak: speak
  };
})(window);