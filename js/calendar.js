/* Calendario local de Andri: guarda los eventos en localStorage del navegador. */
(function (global) {
  'use strict';

  var STORE_KEY = 'andri_events_v1';
  var MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  var events = load();
  var view = { year: new Date().getFullYear(), month: new Date().getMonth() };

  function load() {
    try {
      return JSON.parse(global.localStorage.getItem(STORE_KEY) || '[]') || [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    global.localStorage.setItem(STORE_KEY, JSON.stringify(events));
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fromISO(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function cmp(a, b) {
    var aa = a.time || '99:99';
    var bb = b.time || '99:99';
    return aa.localeCompare(bb);
  }

  function addEvent(data) {
    var ev = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: data.title,
      date: toISO(data.date),
      time: data.time || null,
      allDay: !!data.allDay,
      source: data.source || 'voice',
      createdAt: Date.now()
    };
    events.push(ev);
    save();
    return ev;
  }

  function getByDate(iso) {
    return events.filter(function (e) { return e.date === iso; }).sort(cmp);
  }

  function all() {
    return events.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date) || cmp(a, b);
    });
  }

  function upcoming(days) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    return events.filter(function (e) {
      var d = fromISO(e.date);
      return d >= today && d <= end;
    }).sort(function (a, b) { return a.date.localeCompare(b.date) || cmp(a, b); });
  }

  function removeById(id) {
    var n = events.length;
    events = events.filter(function (e) { return e.id !== id; });
    if (events.length !== n) save();
    return events.length !== n;
  }

  function removeByDate(iso) {
    var n = events.length;
    events = events.filter(function (e) { return e.date !== iso; });
    if (events.length !== n) save();
    return n - events.length;
  }

  function count() { return events.length; }

  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function go(delta) {
    view.month += delta;
    if (view.month < 0) { view.month = 11; view.year--; }
    if (view.month > 11) { view.month = 0; view.year++; }
    render();
  }

  function render() {
    var el = document.getElementById('calendar');
    if (!el) return;

    var label = document.getElementById('monthLabel');
    if (label) label.textContent = MONTHS[view.month] + ' ' + view.year;

    var first = new Date(view.year, view.month, 1);
    var offset = (first.getDay() + 6) % 7; /* semana empieza en lunes */
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var todayISO = toISO(new Date());

    var html = '';
    for (var i = 0; i < 7; i++) html += '<div class="dow">' + DOW[i] + '</div>';
    for (var j = 0; j < offset; j++) html += '<div class="day empty"></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = view.year + '-' + pad(view.month + 1) + '-' + pad(day);
      var list = events.filter(function (e) { return e.date === iso; }).sort(cmp);
      var isToday = iso === todayISO;

      html += '<div class="day' + (isToday ? ' today' : '') + '">';
      html += '<span class="daynum">' + day + '</span>';
      list.forEach(function (ev) {
        html += '<div class="chip' + (ev.allDay ? ' allday' : '') + '" title="' + escapeHTML(ev.title) + '">';
        html += '<span class="ct">' + (ev.time ? ev.time : 'd\u00eda') + '</span>';
        html += '<span class="ctitle">' + escapeHTML(ev.title) + '</span>';
        html += '<button class="xdel" data-id="' + ev.id + '" title="Eliminar">&times;</button>';
        html += '</div>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  }

  document.addEventListener('click', function (e) {
    var del = e.target.closest ? e.target.closest('.xdel') : null;
    if (del) {
      removeById(del.getAttribute('data-id'));
      render();
      return;
    }
    var nav = e.target.closest ? e.target.closest('.nav') : null;
    if (nav) go(nav.id === 'prevMonth' ? -1 : 1);
  });

  global.Calendar = {
    addEvent: addEvent,
    getByDate: getByDate,
    all: all,
    upcoming: upcoming,
    removeById: removeById,
    removeByDate: removeByDate,
    count: count,
    toISO: toISO,
    fromISO: fromISO
  };

  global.renderCalendar = function () { render(); };
})(window);