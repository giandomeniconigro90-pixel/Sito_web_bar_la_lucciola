(function (root) {
  'use strict';
  const config = Object.freeze({
    menuCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT3Ghg506BI5ZZQ8KS34J7rTZMPoK-avgZRYQo7SLy97ftZLUx3OxJq7UPUGYb-4g/pub?gid=1827225984&single=true&output=csv',
    hoursCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThV67Jsk8wnHdlvqTjio2GuPGg0NIdRNzT5tgL5TLSwBzA85jNWec6dG2nRxJqF5-pinUjY_v99rqn/pub?output=csv',
    directions: 'https://www.google.com/maps/dir/?api=1&destination=40.8030722,15.1138307',
    phone: '0827 68069'
  });
  const trim = value => String(value ?? '').trim();
  const categories = Object.freeze(['calde', 'fredde', 'aperitivi', 'alcolici', 'food', 'dolci']);
  function categoryFromSearch(search) {
    const category = new URLSearchParams(search).get('categoria');
    return categories.includes(category) ? category : null;
  }
  function dayToIndex(value) {
    const key = trim(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return ({ dom: 0, domenica: 0, lun: 1, lunedi: 1, mar: 2, martedi: 2, mer: 3, mercoledi: 3, gio: 4, giovedi: 4, ven: 5, venerdi: 5, sab: 6, sabato: 6 })[key] ?? null;
  }
  function timeToMinutes(value) {
    const text = trim(value);
    if (!/^\d{1,2}:\d{2}$/.test(text)) return null;
    const [hour, minute] = text.split(':').map(Number);
    if (hour === 24 && minute === 0) return 1440;
    return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
  }
  function venueNow(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  function parseHoursCsv(rows) {
    const schedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const row of rows) {
      const day = dayToIndex(row.day), startMin = timeToMinutes(row.start), endMin = timeToMinutes(row.end);
      if (day === null || startMin === null || endMin === null || startMin >= 1440 || startMin === endMin) continue;
      schedule[day].push({ start: trim(row.start), end: trim(row.end), startMin, endMin });
    }
    Object.values(schedule).forEach(slots => slots.sort((a, b) => a.startMin - b.startMin));
    return schedule;
  }
  function validHoursResults(results) {
    const fields = results?.meta?.fields || [], rows = results?.data || [];
    if (results?.errors?.length || !['day', 'start', 'end'].every(f => fields.includes(f)) || !rows.length) return false;
    const seen = new Set(), closed = new Set(), open = new Set();
    for (const row of rows) {
      const day = dayToIndex(row.day);
      if (day === null) return false;
      seen.add(day);
      if (trim(row.start).toUpperCase() === 'CHIUSO' && (!trim(row.end) || trim(row.end).toUpperCase() === 'CHIUSO')) closed.add(day);
      else {
        const start = timeToMinutes(row.start), end = timeToMinutes(row.end);
        if (start === null || end === null || start >= 1440 || start === end) return false;
        open.add(day);
      }
    }
    return seen.size === 7 && ![...closed].some(day => open.has(day));
  }
  function validSchedule(schedule) {
    return !!schedule && [0, 1, 2, 3, 4, 5, 6].every(day => Array.isArray(schedule[day]) && schedule[day].every(slot =>
      timeToMinutes(slot.start) === slot.startMin && timeToMinutes(slot.end) === slot.endMin &&
      slot.startMin !== null && slot.endMin !== null && slot.startMin < 1440 && slot.startMin !== slot.endMin));
  }
  function formatDaySlots(slots) {
    return slots?.length ? slots.map(slot => `${slot.start}–${slot.end}`).join(' / ') : 'Chiuso';
  }
  function isOpenNow(schedule, date = venueNow()) {
    if (!schedule) return null;
    const day = date.getDay(), minute = date.getHours() * 60 + date.getMinutes();
    for (const slot of schedule[day] || []) {
      if (slot.endMin > slot.startMin && minute >= slot.startMin && minute < slot.endMin) return true;
      if (slot.endMin < slot.startMin && minute >= slot.startMin) return true;
    }
    return (schedule[(day + 6) % 7] || []).some(slot => slot.endMin < slot.startMin && minute < slot.endMin);
  }
  const cacheKey = 'lucciola:hours:v1:' + config.hoursCsv;
  function readHoursCache(storage, now = Date.now()) {
    try {
      const cached = JSON.parse(storage?.getItem(cacheKey));
      if (validSchedule(cached?.schedule) && Number.isFinite(cached.updatedAt) && now >= cached.updatedAt && now - cached.updatedAt <= 7 * 86400000) return cached;
    } catch (_) {}
    return null;
  }
  function loadHours(parser, storage, timeoutMs = 12000) {
    return new Promise(resolve => {
      let settled = false;
      const fallback = () => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        const cached = readHoursCache(storage);
        resolve(cached ? { ...cached, source: 'cache' } : { schedule: null, source: 'unavailable', updatedAt: null });
      };
      const timer = setTimeout(fallback, timeoutMs); timer.unref?.();
      if (!parser?.parse) { fallback(); return; }
      try {
        parser.parse(config.hoursCsv, { download: true, header: true, skipEmptyLines: 'greedy', transform: trim,
          complete(results) {
            if (settled) return;
            if (!validHoursResults(results)) { fallback(); return; }
            const schedule = parseHoursCsv(results.data), updatedAt = Date.now();
            try { storage?.setItem(cacheKey, JSON.stringify({ schedule, updatedAt })); } catch (_) {}
            settled = true; clearTimeout(timer); resolve({ schedule, updatedAt, source: 'live' });
          }, error: fallback
        });
      } catch (_) { fallback(); }
    });
  }
  const api = Object.freeze({ config, categories, categoryFromSearch, dayToIndex, timeToMinutes, venueNow, parseHoursCsv, validHoursResults, validSchedule, formatDaySlots, isOpenNow, loadHours, readHoursCache });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LucciolaSite = api;
})(typeof window !== 'undefined' ? window : this);
