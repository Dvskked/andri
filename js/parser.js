/* Parser: convierte frases en español en comandos de calendario para Andri.
   No usa API externa: interpreta fechas, horas e intenciones de forma local. */
(function (global) {
  'use strict';

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  var EVENT_TYPES = ['cita medica', 'cita', 'reunion', 'conferencia', 'tarea',
    'recordatorio', 'evento', 'cumpleanos', 'aniversario', 'viaje', 'entrevista',
    'revision', 'examen', 'presentacion', 'fiesta', 'partido', 'consulta', 'clase',
    'sesion', 'concierto', 'comida', 'cena', 'almuerzo', 'desayuno'];

  var FILLERS = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'a', 'al', 'para', 'y', 'con'];

  var LEADING_SKIP = ['tengo', 'quiero', 'necesito', 'me', 'voy', 'vamos',
    'debo', 'puedes', 'ayudame', 'oye', 'ok', 'porfavor', 'por', 'favor',
    'mis', 'mi', 'agenda', 'agendar', 'agrega', 'agregar', 'crea', 'crear',
    'registra', 'registrar', 'guarda', 'guardar', 'apunta', 'anota', 'anade',
    'pon', 'ponme', 'recuerdame', 'recordarme', 'apuntarme'];

  var NUMBER_WORDS = { 'cero': 0, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3,
    'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
    'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
    'quince': 15, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18,
    'diecinueve': 19, 'veinte': 20 };

  function normalize(s) {
    return String(s).toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u').replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9 \.,\/\-:]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function escapeRx(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function detectIntent(s) {
    if (/(borra|elimina|cancela|quita|remueve|retira|borrame|eliminame|cancelar)\b/.test(s)) {
      return 'delete';
    }
    if (/(cuando es|cuando tengo|a que hora|en que dia|que dia|cual es|cuales son|donde esta)\b/.test(s)) {
      return 'ask';
    }
    if (/(que (tengo|hay|eventos|citas|habra)|lista|listame|muestra|muestrame|dime|mis (citas|eventos)|proxim)\b/.test(s)) {
      return 'list';
    }
    if (/(\b(agendar|agenda|agrega|agregar|crea|crear|registra|recuerd|recordatorio|tengo|tener|guardar|guarda|apunta|anota|anade|cita|reunion|conferencia|tarea|evento|viaje|examen|entrevista|cumpleanos|aniversario|concierto|comida|cena|desayuno|almuerzo|sesion|clase|partido|presentacion|prueba|fiesta|revision|consulta|reparacion)\b)/.test(s)) {
      return 'create';
    }
    return 'chat';
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }
  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }
  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function extractDate(s, now) {
    now = now || new Date();
    s = normalize(s);
    var m;

    /* 12/09 · 12-09 · 12/09/2026 */
    m = s.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (m) {
      var day = parseInt(m[1], 10);
      var month = parseInt(m[2], 10) - 1;
      var year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        var d = new Date(year, month, day);
        if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
          if (!m[3] && d < startOfDay(now)) d = new Date(year + 1, month, day);
          return { date: d, iso: iso(d), matched: m[0] };
        }
      }
    }

    /* 15 de abril · 15 de abril de 2026 */
    m = s.match(/(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
    if (m) {
      var monthIdx = MONTHS.indexOf(m[2]);
      if (monthIdx !== -1) {
        var d2 = new Date(m[3] ? parseInt(m[3], 10) : now.getFullYear(), monthIdx, parseInt(m[1], 10));
        if (d2.getDate() === parseInt(m[1], 10) && d2.getMonth() === monthIdx) {
          if (!m[3] && d2 < startOfDay(now)) d2 = new Date(d2.getFullYear() + 1, monthIdx, parseInt(m[1], 10));
          return { date: d2, iso: iso(d2), matched: m[0] };
        }
      }
    }

    /* pasado mañana */
    if (s.replace(/\bde la manana\b/g, '').indexOf('pasado manana') !== -1) {
      var d3 = addDays(startOfDay(now), 2);
      return { date: d3, iso: iso(d3), matched: 'pasado manana' };
    }
    /* mañana (sin confundir con "de la mañana") */
    if (s.replace(/\bde la manana\b/g, '').indexOf('manana') !== -1) {
      var d4 = addDays(startOfDay(now), 1);
      return { date: d4, iso: iso(d4), matched: 'manana' };
    }
    if (/\bhoy\b/.test(s)) {
      var d5 = startOfDay(now);
      return { date: d5, iso: iso(d5), matched: 'hoy' };
    }

    /* fin de semana → próximo sábado */
    if (/\bfin de semana\b/.test(s)) {
      var target = 6, todayIdx = now.getDay();
      var diff = (target - todayIdx + 7) % 7;
      if (diff === 0) diff = 7;
      var d6 = addDays(startOfDay(now), diff);
      return { date: d6, iso: iso(d6), matched: 'fin de semana' };
    }

    /* el 15 (sin mes) */
    m = s.match(/\b(?:el|dia)\s+(\d{1,2})\b(?!\s+de\s+[a-z])/);
    if (m) {
      var day2 = parseInt(m[1], 10);
      if (day2 >= 1 && day2 <= 31) {
        var d7 = new Date(now.getFullYear(), now.getMonth(), day2);
        if (d7 < startOfDay(now)) d7 = new Date(now.getFullYear(), now.getMonth() + 1, day2);
        return { date: d7, iso: iso(d7), matched: m[0] };
      }
    }

    /* día de la semana (este/el/el próximo …) */
    m = s.match(/\b(este|el|los|proximo|proxima)?\s*(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
    if (m) {
      var weekday = m[2];
      var modifier = (m[1] || '').trim();
      var targetIdx = WEEKDAYS.indexOf(weekday);
      var diffW = (targetIdx - now.getDay() + 7) % 7;
      if (diffW === 0) diffW = (modifier === 'este' || modifier === 'el') ? 0 : 7;
      var d8 = addDays(startOfDay(now), diffW);
      return { date: d8, iso: iso(d8), matched: m[0] };
    }

    return null;
  }

  function applyPeriod(h, period) {
    if (period === 'manana') return h === 12 ? 0 : h;
    if (period === 'madrugada') return h === 12 ? 0 : h;
    if (period === 'tarde' || period === 'noche') return h < 12 ? h + 12 : h;
    return h;
  }

  function extractTime(s) {
    s = normalize(s);
    var m, ptc = s.match(/\bde la (manana|tarde|noche|madrugada)\b/);
    var period = ptc ? ptc[1] : null;

    if (/pm\b/.test(s)) period = 'noche';
    if (/am\b/.test(s)) period = 'manana';

    /* 14:30 · 9.30 · 14h30 */
    m = s.match(/(\d{1,2})[:.h](\d{2})\b/);
    if (m) {
      var h = parseInt(m[1], 10);
      var mins = parseInt(m[2], 10);
      if (mins > 59 || h > 24) return null;
      return { hours: applyPeriod(h, period), minutes: mins, matched: m[0] };
    }

    /* a las 4 · las 9 · a la 1 · a las cuatro · a la una */
    m = s.match(/(?:a las|a la|las)\s+(cero|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|\d{1,2})(?![:\d])/);
    if (m) {
      var hv = /\d/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]];
      if (hv === undefined || hv > 24) return null;
      var h2 = applyPeriod(hv, period);
      if (h2 === 0 && /am\b/.test(s)) h2 = 0;
      return { hours: h2, minutes: 0, matched: m[0] };
    }

    /* 4 pm / 9 am */
    m = s.match(/[^a-z0-9](\d{1,2})\s*(am|pm)\b/);
    if (m) {
      var h3 = parseInt(m[1], 10);
      var isPm = m[2].toLowerCase() === 'pm';
      if (isPm && h3 < 12) h3 += 12;
      if (!isPm && h3 === 12) h3 = 0;
      return { hours: h3, minutes: 0, matched: (m[0]).trim() };
    }

    /* 14 horas */
    m = s.match(/(\d{1,2})\s+horas?\b/);
    if (m) {
      var h4 = parseInt(m[1], 10);
      if (h4 <= 24) return { hours: h4, minutes: 0, matched: m[0] };
    }

    if (/\bmediodia\b/.test(s)) return { hours: 12, minutes: 0, matched: 'mediodia' };
    if (/\bmedianoche\b/.test(s)) return { hours: 0, minutes: 0, matched: 'medianoche' };

    return null;
  }

  function findEventType(s) {
    for (var i = 0; i < EVENT_TYPES.length; i++) {
      if (s.indexOf(EVENT_TYPES[i]) !== -1) return EVENT_TYPES[i];
    }
    return null;
  }

  function extractTitle(contents, parsed) {
    var s = normalize(contents);
    if (parsed.date) s = s.replace(new RegExp(escapeRx(parsed.date.matched), 'g'), ' ');
    if (parsed.time) s = s.replace(new RegExp(escapeRx(parsed.time.matched), 'g'), ' ');
    s = s.replace(/\bde la (manana|tarde|noche|madrugada)\b/g, ' ');
    s = s.replace(/\b(am|pm)\b/g, ' ');

    var words = s.split(/[^a-z0-9]+/).filter(Boolean).slice(0, 12);
    var startIdx = 0;
    while (startIdx < words.length &&
      (LEADING_SKIP.indexOf(words[startIdx]) !== -1 || FILLERS.indexOf(words[startIdx]) !== -1)) {
      startIdx++;
    }

    var slice = words.slice(startIdx, startIdx + 6);
    var title = slice.filter(function (w) { return FILLERS.indexOf(w) === -1; }).join(' ');

    if (!title) title = parsed.eventType || 'Evento';
    return title.split(' ').map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(' ');
  }

  function extractKeywords(s, parsed) {
    s = normalize(s);
    if (parsed) {
      if (parsed.date) s = s.replace(new RegExp(escapeRx(parsed.date.matched), 'g'), ' ');
      if (parsed.time) s = s.replace(new RegExp(escapeRx(parsed.time.matched), 'g'), ' ');
    }
    var stop = new Set(['me', 'mi', 'mis', 'el', 'la', 'los', 'las', 'de', 'del',
      'para', 'por', 'con', 'un', 'una', 'unos', 'unas', 'y', 'que', 'cuando',
      'es', 'son', 'tengo', 'hay', 'lista', 'dime', 'muestra', 'muestrame',
      'borra', 'elimina', 'cancela', 'quita', 'remueve', 'retira', 'en', 'a', 'al']);
    return s.split(/[^a-z0-9]+/).filter(Boolean)
      .filter(function (w) { return !stop.has(w) && !/^\d+$/.test(w); })
      .map(function (w) {
        if (w.length > 3 && w.slice(-2) === 'os') return w.slice(0, -1);
        if (w.length > 3 && w.slice(-2) === 'as') return w.slice(0, -1);
        return w;
      })
      .slice(0, 6);
  }

  function parse(text) {
    var raw = String(text);
    var normalized = normalize(raw);

    var parsed = {
      intent: 'chat',
      title: 'Evento',
      date: null,
      time: null,
      allDay: true,
      eventType: null,
      keywords: [],
      hasWake: false,
      raw: raw,
      normalized: normalized,
      cleaned: normalized
    };

    var wake = /\bandri[a-z0-9]*\b|\bandry\b|\bandra\b|corta voz\b/;
    parsed.hasWake = wake.test(raw);
    normalized = normalized.replace(wake, ' ').replace(/\s+/g, ' ').trim();
    parsed.cleaned = normalized;

    parsed.intent = detectIntent(normalized);
    parsed.date = extractDate(normalized);
    parsed.time = extractTime(normalized);
    parsed.eventType = findEventType(normalized);

    if (parsed.intent === 'create') {
      parsed.title = extractTitle(normalized, parsed);
      parsed.allDay = !parsed.time;
    }
    if (parsed.intent === 'list' || parsed.intent === 'ask' || parsed.intent === 'delete') {
      parsed.keywords = extractKeywords(normalized, parsed);
    }

    return parsed;
  }

  global.Parser = {
    parse: parse,
    normalize: normalize,
    extractDate: extractDate,
    extractTime: extractTime,
    WEEKDAYS: WEEKDAYS,
    MONTHS: MONTHS
  };
})(window);