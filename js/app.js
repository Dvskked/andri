/* App: une la interfaz con Speech, Andri y el calendario. */
(function (global) {
  'use strict';

  var Speech = global.Speech;
  var Andri = global.Andri;

  function $(id) { return document.getElementById(id); }
  var micBtn = $('micBtn');
  var sendBtn = $('sendBtn');
  var textInput = $('textInput');
  var statusEl = $('status');
  var conversation = $('conversation');
  var recordingsEl = $('recordings');
  var audio = new Audio();

  function setStatus(msg) { statusEl.textContent = msg; }

  function pushMessage(role, text) {
    var box = document.createElement('div');
    box.className = 'msg ' + role;

    var who = document.createElement('span');
    who.className = 'who';
    who.textContent = role === 'user' ? 'Tu' : 'Andri';

    var body = document.createElement('div');
    body.className = 'txt';
    body.textContent = text;

    box.appendChild(who);
    box.appendChild(body);
    conversation.appendChild(box);
    conversation.scrollTop = conversation.scrollHeight;
  }

  function renderRecordings() {
    recordingsEl.innerHTML = '';
    var list = Speech.getRecordings();

    if (!list.length) {
      var li0 = document.createElement('li');
      li0.className = 'empty';
      li0.textContent = 'Todav\u00eda no hay grabaciones.';
      recordingsEl.appendChild(li0);
      return;
    }

    list.forEach(function (rec) {
      var li = document.createElement('li');

      var btn = document.createElement('button');
      btn.className = 'play';
      btn.textContent = '\u25B6';
      btn.title = 'Reproducir';
      btn.onclick = function () {
        if (audio.src !== rec.url || audio.paused) {
          audio.src = rec.url;
          audio.play();
        } else {
          audio.pause();
        }
      };

      var info = document.createElement('div');
      info.className = 'recinfo';

      var time = document.createElement('span');
      time.className = 'rectime';
      time.textContent = rec.date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + ' \u00b7 ' + rec.duration;

      var txt = document.createElement('span');
      txt.className = 'rectxt';
      txt.textContent = rec.transcript ? '\u00ab' + rec.transcript + '\u00bb' : 'Sin transcripci\u00f3n';

      info.appendChild(time);
      info.appendChild(txt);
      li.appendChild(btn);
      li.appendChild(info);
      recordingsEl.appendChild(li);
    });
  }

  async function toggleMic() {
    if (Speech.isActive()) {
      setStatus('Procesando tu voz\u2026');
      Speech.stopSession();
      micBtn.classList.remove('rec');
    } else {
      try {
        await Speech.startSession();
        micBtn.classList.add('rec');
        setStatus('Escuchando\u2026 di tu comando.');
      } catch (err) {
        setStatus('No pude acceder al micr\u00f3fono. Revisa los permisos del navegador e int\u00e9ntalo de nuevo.');
        micBtn.classList.remove('rec');
      }
    }
  }

  Speech.setCallbacks({
    onRecording: function (rec) {
      micBtn.classList.remove('rec');
      renderRecordings();
      if (rec.transcript) {
        pushMessage('user', rec.transcript);
        setStatus('Procesando\u2026');
        Andri.process(rec.transcript, { requireWake: true });
      } else {
        setStatus('No escuch\u00e9 nada. Pulsa el micr\u00f3fono e int\u00e9ntalo de nuevo.');
      }
    },
    onTranscript: function (t) {
      if (Speech.isActive() && t) setStatus('Escuchando\u2026 \u00ab' + t + '\u00bb');
    },
    onError: function (msg) { setStatus(msg); }
  });

  Andri.setHooks({
    onMessage: function (role, text) {
      pushMessage(role, text);
      setStatus('Andri est\u00e1 listo. Pulsa el micr\u00f3fono para hablar o escribe un comando.');
    },
    onChanged: function () { global.renderCalendar(); }
  });

  function sendText() {
    var t = textInput.value.trim();
    if (!t) return;
    textInput.value = '';
    pushMessage('user', t);
    setStatus('Procesando\u2026');
    Andri.process(t, { requireWake: false });
  }

  micBtn.addEventListener('click', toggleMic);
  sendBtn.addEventListener('click', sendText);
  textInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendText();
  });

  function init() {
    global.renderCalendar();
    renderRecordings();

    if (!Speech.supported()) {
      setStatus('Tu navegador no permite grabar audio. Puedes seguir usando el campo de texto.');
    } else if (!Speech.srSupported()) {
      setStatus('Este navegador no tiene reconocimiento de voz, pero puedes grabar audio y usar el texto.');
    }
    if (!('speechSynthesis' in global)) {
      setStatus('Advertencia: este navegador no puede hablar (s\u00edntesis de voz no disponible).');
    }
    if ('speechSynthesis' in global) global.speechSynthesis.getVoices();
  }

  init();
})(window);