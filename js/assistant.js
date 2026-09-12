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

  function describeToday(iso) {
    var d = toDate(iso);
    return DOW_CAP[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS_AB[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function deDate(iso) {
    var l = describeDate(iso);
    return l.indexOf('el ') === 0 ? 'del ' + l.slice(3) : 'de ' + l;
  }

  function describeClock(hours, minutes) {
    var m = minutes || 0;
    var h = hours;
    if (h === 0) return m ? 'las 12 y ' + m + ' de la madrugada' : 'las 12 de la madrugada';
    if (h === 12) return m ? 'las 12 y ' + m + ' del mediod\u00eda' : 'las 12 del mediod\u00eda';

    var part, art;
    if (h < 12) { part = 'de la ma\u00f1ana'; }
    else if (h < 19) { h -= 12; part = 'de la tarde'; }
    else { h -= 12; part = 'de la noche'; }
    art = h === 1 ? 'la' : 'las';
    return m ? art + ' ' + h + ' y ' + m + ' ' + part : art + ' ' + h + ' ' + part;
  }

  function describeTime(hours, minutes) {
    return 'a ' + describeClock(hours, minutes);
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
    var dates = parsed.dates && parsed.dates.length ? parsed.dates.slice(0, 4)
      : (parsed.date ? [parsed.date] : []);

    if (!dates.length) {
      say('No entend\u00ed bien la fecha. Intenta algo como: Andri, tengo una cita el s\u00e1bado a las 4 de la tarde.');
      return;
    }

    var t = parsed.time;
    var time = t ? pad(t.hours) + ':' + pad(t.minutes) : null;
    var created = dates.map(function (d) {
      return Calendar.addEvent({
        title: parsed.title || 'Evento',
        date: d.date,
        time: time,
        allDay: !t,
        source: 'voice'
      });
    });
    notifyChanged();

    var timeTxt = t ? ' ' + describeTime(t.hours, t.minutes) : ' (todo el d\u00eda)';

    if (created.length === 1) {
      var when = describeDate(created[0].date);
      say('\u00a1Listo! Agend\u00e9 ' + quote(created[0].title) + ' para ' + when + timeTxt + '.');
      return;
    }

    var days = created.map(function (ev) { return describeDate(ev.date); }).join(' y ');
    say('\u00a1Hecho! Agend\u00e9 ' + quote(created[0].title) + ' para ' + days + timeTxt + '. Son ' + created.length + ' fechas en total.');
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
    say('Tu pr\u00f3ximo evento es ' + quote(ev.title) + ' para ' + describeDate(ev.date) + ' ' + describeTimeStored(ev.time) + '.');
  }

  function doDelete(parsed) {
    var targets = [];

    if (parsed.dates && parsed.dates.length) {
      parsed.dates.slice(0, 4).forEach(function (d) {
        targets = targets.concat(Calendar.getByDate(d.iso));
      });
    } else {
      targets = Calendar.upcoming(9999);
    }

    /* eliminar duplicados por id */
    var seen = {};
    targets = targets.filter(function (ev) {
      if (seen[ev.id]) return false;
      seen[ev.id] = true;
      return true;
    });

    if (parsed.keywords && parsed.keywords.length) {
      var kw = parsed.keywords;
      targets = targets.filter(function (ev) {
        var t = Parser.normalize(ev.title);
        return kw.some(function (k) { return t.indexOf(k) !== -1; });
      });
    }

    if (!targets.length) {
      say('No encontr\u00e9 ning\u00fan evento que eliminar' +
        (parsed.date ? ' ' + deDate(parsed.date.iso) : '') + '.');
      return;
    }

    targets.forEach(function (ev) { Calendar.removeById(ev.id); });
    var n = targets.length;
    var names = targets.slice(0, 3).map(function (ev) { return quote(ev.title); }).join(', ');
    say('Elimin\u00e9 ' + n + (n === 1 ? ' evento' : ' eventos') +
      (names ? ' (' + names + (n > 3 ? ' y m\u00e1s' : '') + ')' : '') +
      (parsed.date ? ' ' + deDate(parsed.date.iso) : '') + '.');
    notifyChanged();
  }

  function doTime() {
    var now = new Date();
    say('Son ' + describeClock(now.getHours(), now.getMinutes()) + '.');
  }

  function doDate() {
    var now = new Date();
    say('Hoy es ' + describeToday(Calendar.toISO(now)) + '.');
  }

  function doHelp() {
    say('Hola, soy Andri, tu asistente por voz.\n' +
        'Puedo hacer cosas como:\n' +
        '\u2022 Agendar citas u eventos: "tengo una cita el s\u00e1bado a las 4 de la tarde".\n' +
        '\u2022 Agendar varias fechas: "reuni\u00f3n el lunes y el mi\u00e9rcoles a las 10".\n' +
        '\u2022 Decirte la hora o la fecha de hoy.\n' +
        '\u2022 Listar lo que tienes: "\u00bfqu\u00e9 tengo ma\u00f1ana?".\n' +
        '\u2022 Buscar un evento y eliminar citas.',
        'Hola, soy Andri. Puedo agendar citas y eventos, recordarte tus planes, decirte la hora y la fecha, listar lo que tienes y eliminar eventos. Pulsa el micr\u00f3fono y dime qu\u00e9 necesitas.');
  }

  function process(input, opts) {
    opts = opts || {};
    var text = String(input).trim();
    if (!text) return;

    var parsed = Parser.parse(text);

    if (parsed.intent === 'chat') {
      if (opts.requireWake && !parsed.hasWake) {
        say('Disculpa, soy Andri. Di "Andri" primero y luego lo que necesitas. Por ejemplo: Andri, tengo una cita el s\u00e1bado a las 4 de la tarde.');
        return;
      }
      say('Todav\u00eda no s\u00e9 hacer eso, pero puedo agendar citas y eventos en tu calendario, decirte qu\u00e9 tienes o eliminar eventos. Di, por ejemplo: Andri, agrega una reuni\u00f3n el lunes a las 9 de la ma\u00f1ana.');
      return;
    }

    switch (parsed.intent) {
      case 'create': doCreate(parsed); break;
      case 'list': doList(parsed); break;
      case 'ask': doAsk(parsed); break;
      case 'delete': doDelete(parsed); break;
      case 'time': doTime(); break;
      case 'date': doDate(); break;
      case 'help': doHelp(); break;
      default: break;
    }
  }

  global.Andri = {
    process: process,
    setHooks: function (h) { hooks = h || hooks; }
  };
})(window);