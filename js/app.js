/* App: une la interfaz con Speech, Andri y el calendario. */
(function (global) {
  'use strict';

  var Speech = global.Speech;
  var Andri = global.Andri;

  function $(id) { return document.getElementById(id); }
  var micBtn = $('micBtn');
  var micLevel = $('micLevel');
  var levelBars = micLevel ? Array.prototype.slice.call(micLevel.children) : [];
  var sendBtn = $('sendBtn');
  var textInput = $('textInput');
  var statusEl = $('status');
  var conversation = $('conversation');
  var recordingsEl = $('recordings');
  var recCount = $('recCount');
  var clearRec = $('clearRec');
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

  /* --- Medidor de nivel de voz --- */
  function setLevel(level) {
    if (!micLevel) return;
    micLevel.classList.toggle('on', level > 0.02);
    var lit = Math.max(0, Math.min(levelBars.length, Math.ceil(level * levelBars.length)));
    for (var i = 0; i < levelBars.length; i++) {
      levelBars[i].classList.toggle('lit', i < lit);
    }
  }

  /* --- Grabadora / transcripción --- */
  Speech.setCallbacks({
    onRecording: function (rec) {
      micBtn.classList.remove('rec');
      setLevel(0);
      renderRecordings();
      if (rec.transcript) {
        pushMessage('user', rec.transcript);
        setStatus('Procesando\u2026');
        Andri.process(rec.transcript, { requireWake: true });
      } else {
        setStatus('No escuch\u00e9 nada. Pulsa el micr\u00f3fono e int\u00e9ntalo de nuevo.');
      }
    },
    onTranscript: function (t, isFinal) {
      if (Speech.isActive() && t) {
        setStatus(isFinal
          ? 'Escuchado: \u00ab' + t + '\u00bb'
          : 'Escuchando\u2026 \u00ab' + t + '\u00bb');
      }
    },
    onError: function (msg) { setStatus(msg); },
    onLevel: function (level) { setLevel(level); }
  });

  function toggleMic() {
    if (Speech.isActive()) {
      setStatus('Procesando tu voz\u2026');
      Speech.stopSession();
      micBtn.classList.remove('rec');
    } else {
      var started = Speech.startSession();
      Promise.resolve(started)
        .then(function () {
          micBtn.classList.add('rec');
          setStatus('Escuchando\u2026 di tu comando.');
        })
        .catch(function () {
          micBtn.classList.remove('rec');
          setStatus('No pude acceder al micr\u00f3fono. Revisa los permisos del navegador e int\u00e9ntalo de nuevo.');
        });
    }
  }

  micBtn.addEventListener('click', toggleMic);

  /* --- Andri --- */
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

  sendBtn.addEventListener('click', sendText);
  textInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendText();
  });

  /* --- Grabaciones: lista con reproducir / borrar, y vaciar --- */
  function renderRecordings() {
    if (!recordingsEl) return;
    recordingsEl.innerHTML = '';
    var list = Speech.getRecordings();

    if (recCount) recCount.textContent = list.length ? '(' + list.length + ')' : '';
    if (clearRec) clearRec.style.visibility = list.length ? 'visible' : 'hidden';

    if (!list.length) {
      var li0 = document.createElement('li');
      li0.className = 'empty';
      li0.textContent = 'Todav\u00eda no hay grabaciones.';
      recordingsEl.appendChild(li0);
      return;
    }

    list.slice(0, global.RecordingStore ? global.RecordingStore.MAX_KEEP : 30).forEach(function (rec) {
      var li = document.createElement('li');

      var btn = document.createElement('button');
      btn.className = 'play';
      btn.textContent = '\u25B6';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Reproducir grabaci\u00f3n');

      function togglePlay() {
        if (audio.src !== rec.url || audio.paused) {
          btn.classList.add('playing');
          btn.textContent = '\u23F8';
          audio.src = rec.url;
          audio.play();
        } else {
          audio.pause();
          btn.classList.remove('playing');
          btn.textContent = '\u25B6';
        }
        audio.onended = function () {
          btn.classList.remove('playing');
          btn.textContent = '\u25B6';
        };
      }
      btn.onclick = togglePlay;

      var info = document.createElement('div');
      info.className = 'recinfo';

      var time = document.createElement('span');
      time.className = 'rectime';
      time.textContent = rec.date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + ' \u00b7 ' + rec.duration;

      var txt = document.createElement('span');
      txt.className = 'rectxt';
      txt.textContent = rec.transcript ? '\u00ab' + rec.transcript + '\u00bb' : 'Audio sin transcripci\u00f3n';

      info.appendChild(time);
      info.appendChild(txt);

      var del = document.createElement('button');
      del.className = 'delRec';
      del.textContent = '\u2715';
      del.type = 'button';
      del.setAttribute('aria-label', 'Eliminar grabaci\u00f3n');
      del.onclick = function () {
        if (audio.src === rec.url) { audio.pause(); audio.src = ''; }
        Speech.removeRecording(rec.id);
        renderRecordings();
      };

      li.appendChild(btn);
      li.appendChild(info);
      li.appendChild(del);
      recordingsEl.appendChild(li);
    });
  }

  if (clearRec) {
    clearRec.addEventListener('click', function () {
      audio.pause(); audio.src = '';
      Speech.clearRecordings();
      renderRecordings();
      setStatus('Grabaciones eliminadas.');
    });
  }

  /* --- Inicio --- */
  function init() {
    global.renderCalendar();
    renderRecordings();

    Speech.loadStored()
      .then(function () { renderRecordings(); })
      .catch(function () { /* noop */ });

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