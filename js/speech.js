/* Captura de voz (grabación + transcripción) y síntesis de voz para Andri.
   Todo ocurre en el navegador; no hay servidor de por medio. */
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

  var cb = { onRecording: null, onTranscript: null, onError: null };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && global.MediaRecorder);
  }

  function srSupported() { return !!SR; }

  function makeRecognition() {
    if (!SR) return null;
    var r = new SR();
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = function (ev) {
      var t = '';
      for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      accumulatedText = t.trim();
      if (cb.onTranscript) cb.onTranscript(accumulatedText);
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
      if (cb.onTranscript) cb.onTranscript(accumulatedText);
    };

    return r;
  }

  async function startSession() {
    if (sessionActive) return;
    sessionActive = true;
    accumulatedText = '';

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        duration: fmtDur(Date.now() - recStart),
        blob: blob,
        url: URL.createObjectURL(blob),
        transcript: accumulatedText
      };
      recordings.unshift(rec);

      if (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
      }
      recorder = null;

      if (cb.onRecording) cb.onRecording(rec);
    };

    recStart = Date.now();
    recorder.start();

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
  function getRecordings() { return recordings; }
  function setCallbacks(o) {
    if (o) {
      if (o.onRecording) cb.onRecording = o.onRecording;
      if (o.onTranscript) cb.onTranscript = o.onTranscript;
      if (o.onError) cb.onError = o.onError;
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
    getRecordings: getRecordings,
    setCallbacks: setCallbacks,
    speak: speak
  };
})(window);