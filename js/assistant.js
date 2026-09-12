/* Andri: lógica del asistente. Interpreta el comando y responde actuando
   sobre el calendario local, por texto y por voz. */
(function (global) {
  'use strict';

  var Parser = global.Parser;
  var Calendar = global.Calendar;
  var Speech = global.Speech;

  var MONTHS_AB = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DOW_CAP = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];

  var hooks = { onMessage: null, onChanged: null };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function startOfToday(now) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function describeDate(iso) {
    var now = new Date();
    var d = toDate(iso);
    var today = startOfToday(now);
    var diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'ma\u00f1ana';
    return 'el ' + DOW_CAP[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS_AB[d.getMonth()];
  }

  function describeTime(hours, minutes) {
    var m = minutes || 0;
    var h = hours;
    if (h === 0) return m ? 'a la 12 y ' + m + ' de la madrugada' : 'a las 12 de la madrugada';
    if (h === 12) return m ? 'a las 12 y ' + m + ' del mediod\u00eda' : 'a las 12 del mediod\u00eda';

    var part, art;
    if (h < 12) { part = 'de la ma\u00f1ana'; }
    else if (h < 19) { h -= 12; part = 'de la tarde'; }
    else { h -= 12; part = 'de la noche'; }
    art = h === 1 ? 'la' : 'las';
    return m ? 'a ' + art + ' ' + h + ' y ' + m + ' ' + part : 'a ' + art + ' ' + h + ' ' + part;
  }

  function describeTimeStored(t) {
    if (!t) return 'todo el d\u00eda';
    var p = t.split(':').map(Number);
    return describeTime(p[0], p[1]);
  }

  function quote(s) { return '\u00ab' + s + '\u00bb'; }

  function say(text, spoken) {
    if (hooks.onMessage) hooks.onMessage('andri', text);
    Speech.speak(spoken || text);
  }

  function notifyChanged() {
    if (hooks.onChanged) hooks.onChanged();
  }

  function doCreate(parsed) {
    if (!parsed.date) {
      say('No entend\u00ed bien la fecha. Intenta algo como: Andri, tengo una cita el s\u00e1bado a las 4 de la tarde.');
      return;
    }
    var t = parsed.time;
    var ev = Calendar.addEvent({
      title: parsed.title || 'Evento',
      date: parsed.date.date,
      time: t ? pad(t.hours) + ':' + pad(t.minutes) : null,
      allDay: !t,
      source: 'voice'
    });
    var when = describeDate(ev.date);
    var timeTxt = t ? ' ' + describeTime(t.hours, t.minutes) : ' (todo el d\u00eda)';
    say('\u00a1Listo! Agend\u00e9 ' + quote(ev.title) + ' para ' + when + timeTxt + '.');
    notifyChanged();
  }

  function doList(parsed) {
    var list, label;
    if (parsed.date) {
      list = Calendar.getByDate(parsed.date.iso);
      label = describeDate(parsed.date.iso);
    } else {
      list = Calendar.upcoming(30);
      label = 'los pr\u00f3ximos 30 d\u00edas';
    }

    if (!list.length) {
      say('No tienes nada agendado ' +
        (parsed.date ? 'para ' + label : 'en los pr\u00f3ximos 30 d\u00edas') + '.');
      return;
    }

    var n = list.length;
    var lines = list.slice(0, 10).map(function (ev, i) {
      var when = parsed.date
        ? describeTimeStored(ev.time)
        : describeDate(ev.date) + ' ' + describeTimeStored(ev.time);
      return (i + 1) + '. ' + ev.title + ' \u2014 ' + when;
    });
    var msg = 'Tienes ' + n + (n === 1 ? ' evento' : ' eventos') + ' para ' + label + ':\n' + lines.join('\n');

    var spoken;
    if (n === 1) {
      var ev1 = list[0];
      spoken = 'Tienes un evento para ' + label + ': ' + ev1.title + ', ' + describeTimeStored(ev1.time) + '.';
    } else {
      var few = list.slice(0, 3).map(function (ev) {
        return ev.title + ', ' + describeTimeStored(ev.time);
      });
      spoken = 'Tienes ' + n + ' eventos para ' + label + '. ' +
        few.join('; ') + (n > 3 ? ', y ' + (n - 3) + ' m\u00e1s.' : '.');
    }

    say(msg, spoken);
  }

  function doAsk(parsed) {
    var kw = parsed.keywords || [];
    var today = startOfToday(new Date());
    var cands = Calendar.all().filter(function (e) { return toDate(e.date) >= today; });

    if (kw.length) {
      cands = cands.filter(function (ev) {
        var t = Parser.normalize(ev.title);
        return kw.some(function (k) { return t.indexOf(k) !== -1; });
      });
    }

    if (!cands.length) {
      say(kw.length
        ? 'No encontr\u00e9 eventos que coincidan con ' + quote(kw.join(' ')) + '.'
        : 'No tienes eventos pr\u00f3ximos.');
      return;
    }

    var ev = cands[0];
    var timeTxt = ' ' + describeTimeStored(ev.time);
    say('Tu pr\u00f3ximo evento es ' + quote(ev.title) + ' para ' + describeDate(ev.date) + timeTxt + '.');
  }

  function doDelete(parsed) {
    var targets;
    if (parsed.date) {
      targets = Calendar.getByDate(parsed.date.iso);
    } else {
      targets = Calendar.upcoming(9999);
    }

    if (parsed.keywords && parsed.keywords.length) {
      var kw = parsed.keywords;
      targets = targets.filter(function (ev) {
        var t = Parser.normalize(ev.title);
        return kw.some(function (k) { return t.indexOf(k) !== -1; });
      });
    }

    if (!targets.length) {
      say('No encontr\u00e9 ning\u00fan evento que eliminar' +
        (parsed.date ? ' de ' + describeDate(parsed.date.iso) : '') + '.');
      return;
    }

    targets.forEach(function (ev) { Calendar.removeById(ev.id); });
    var n = targets.length;
    var names = targets.slice(0, 3).map(function (ev) { return quote(ev.title); }).join(', ');
    say('Elimin\u00e9 ' + n + (n === 1 ? ' evento' : ' eventos') +
      (names ? ' (' + names + (n > 3 ? ' y m\u00e1s' : '') + ')' : '') +
      (parsed.date ? ' de ' + describeDate(parsed.date.iso) : '') + '.');
    notifyChanged();
  }

  function process(input, opts) {
    opts = opts || {};
    var text = String(input).trim();
    if (!text) return;

    var parsed = Parser.parse(text);

    if (opts.requireWake && !parsed.hasWake) {
      say('Disculpa, soy Andri. Di "Andri" primero y luego lo que necesitas. Por ejemplo: Andri, tengo una cita el s\u00e1bado a las 4 de la tarde.');
      return;
    }

    switch (parsed.intent) {
      case 'create': doCreate(parsed); break;
      case 'list': doList(parsed); break;
      case 'ask': doAsk(parsed); break;
      case 'delete': doDelete(parsed); break;
      default:
        say('Todav\u00eda no s\u00e9 hacer eso, pero puedo agendar citas y eventos en tu calendario, decirte qu\u00e9 tienes o eliminar eventos. Di, por ejemplo: Andri, agrega una reuni\u00f3n el lunes a las 9 de la ma\u00f1ana.');
    }
  }

  global.Andri = {
    process: process,
    setHooks: function (h) { hooks = h || hooks; }
  };
})(window);