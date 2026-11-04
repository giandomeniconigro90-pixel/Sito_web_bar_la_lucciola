/* script.js - Bar La Lucciola */

/* ===========================
   COSTANTI / CONFIG
   =========================== */
const allergenMap = {
  latte: { icon: '🥛', label: 'Latte' },
  glutine: { icon: '🌾', label: 'Glutine' },
  uova: { icon: '🥚', label: 'Uova' },
  guscio: { icon: '🥜', label: 'Frutta a guscio' },
  sedano: { icon: '🌿', label: 'Sedano' }
};

const Venue = window.LucciolaSite;
const PREVIEW_VIEW_KEY = 'lucciola:preview:lite:' + (window.location?.pathname || '/menu-bozza/');
const SHEET_URL = Venue.config.menuCsv;
const HOURS_CSV_URL = Venue.config.hoursCsv;

const CATEGORY_TITLES = {
  calde: 'Caffetteria',
  fredde: 'Bibite Fredde',
  aperitivi: 'Aperitivi & Cocktail',
  alcolici: 'Vini & Alcolici',
  food: 'Food & Snack',
  dolci: 'Dolci & Dessert',
  altro: 'Altro'
};

const PREFERRED_SUBCAT_ORDER = [
  'Aperitivi',
  'Cocktail',
  'Birre',
  'Vini',
  'Amari',
  'Liquori',
  'Grappe'
];

/* ===========================
   STATO
   =========================== */
let menuData = {};
let scheduledNotices = [];
let themeSettings = [];
let menuFetchInProgress = false;
let previousMenuRows = null;

// {0..6: [{start,end,startMin,endMin}, ...]}
let openingSchedule = null;
let hoursSource = "loading";
let hoursRequest = null;

/* ===========================
   UTILS
   =========================== */
function safeTrim(value) {
  return String(value ?? '').trim();
}

function isFalseLike(value) {
  const v = safeTrim(value).toLowerCase();
  return v === 'no' || v === 'false';
}

function isSoldOutLike(value) {
  return safeTrim(value).toLowerCase() === 'soldout';
}

function getActiveCategoryFromOnclick(btn) {
  return btn?.dataset?.cat || null;
}

const storage = {
  getItem(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
  setItem(key, value) { try { localStorage.setItem(key, value); } catch (_) {} },
  removeItem(key) { try { localStorage.removeItem(key); } catch (_) {} }
};
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
function parsePrice(value) {
  const text = safeTrim(value).replace(',', '.');
  return /^\d+(?:\.\d{1,2})?$/.test(text) ? Number(text) : null;
}
function menuNotice(text) {
  const el = document.getElementById('menu-notice');
  if (el) { el.textContent = text; el.hidden = !text; }
}
function validMenu(data) {
  return data && typeof data === 'object' && !Array.isArray(data) &&
    Object.values(data).every(c => c && typeof c.title === 'string' && Array.isArray(c.items) &&
      c.items.every(i => i && typeof i.name === 'string' && typeof i.subcategory === 'string' && Array.isArray(i.allergens)));
}
function validateMenuResults(results) {
  const fields = results.meta?.fields || [];
  if (!['categoria', 'nome', 'prezzo'].every(f => fields.includes(f)) || results.errors?.length) {
    throw new Error('CSV del menù non valido');
  }
}
/* ===========================
   ORARI: CSV -> TAB + STATUS
   =========================== */
function dayToIndex(day) { return Venue.dayToIndex(day); }
function timeToMinutes(time) { return Venue.timeToMinutes(time); }
function venueNow() { return Venue.venueNow(); }
function parseHoursCsv(rows) { return Venue.parseHoursCsv(rows); }
function formatDaySlots(slots) { return Venue.formatDaySlots(slots); }
function renderOpeningHoursTable() {
  const box = document.getElementById('opening-hours-box');
  if (!box) return;

  if (!openingSchedule) {
    box.innerHTML = '<div class="opening-hours-title">Orari</div><p class="hours-source">' + (hoursSource === 'loading' ? 'Verifico gli orari…' : 'Orari non disponibili. Chiama il bar per conferma.') + '</p>';
    return;
  }
  const names = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const today = venueNow().getDay();

  let html = `<div class="opening-hours-title">Orari</div>`;
  html += `<table class="opening-hours-table">`;

  for (let d = 0; d <= 6; d++) {
    const rowClass = d === today ? 'opening-hours-today' : '';
    html += `
      <tr class="${rowClass}">
        <td>${names[d]}</td>
        <td>${escapeHtml(formatDaySlots(openingSchedule[d]))}</td>
      </tr>
    `;
  }

  html += `</table>${hoursSource === 'cache' ? '<p class="hours-source">Ultimi orari salvati. Chiama per conferma.</p>' : ''}`;
  box.innerHTML = html;
}

function isOpenNow(dateObj) { return Venue.isOpenNow(openingSchedule, dateObj); }
function initOpeningHours() {
  if (hoursRequest) return hoursRequest;
  renderOpeningHoursTable(); checkOpenStatus();
  hoursRequest = Venue.loadHours(typeof Papa === 'undefined' ? null : Papa, storage).then(result => {
    openingSchedule = result.schedule; hoursSource = result.source;
    renderOpeningHoursTable(); checkOpenStatus();
  }).finally(() => { hoursRequest = null; });
  return hoursRequest;
}
function restoreMenuView() {
  const input = document.getElementById('menu-search');
  if (input?.value.trim()) { searchMenu(); return; }
  const active = document.querySelector('.tab-btn.active');
  showCategory(getActiveCategoryFromOnclick(active) || 'calde', null);
}
// Date-only rules use the venue calendar (Europe/Rome), inclusive on both ends.
function parseCalendarDate(value) {
  const text = safeTrim(value);
  if (!text) return '';
  let year, month, day;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    [, day, month, year] = match;
  }
  year = Number(year); month = Number(month); day = Number(day);
  if (year < 1900 || year > 9999) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function venueDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const fields = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
function isScheduledRowActive(row, today = venueDateKey()) {
  if (isFalseLike(row.disponibile)) return false;
  const start = parseCalendarDate(row.data_inizio);
  const end = parseCalendarDate(row.data_fine);
  if (start === null || end === null || (start && end && start > end)) return false;
  return (!start || today >= start) && (!end || today <= end);
}
function themeForRows(rows, today = venueDateKey()) {
  let theme = 'normale';
  for (const row of rows) {
    const value = safeTrim(row.descrizione).toLowerCase();
    if (isScheduledRowActive(row, today) && ['normale', 'natale'].includes(value)) theme = value;
  }
  return theme;
}
function updateBrandLogo(theme) {
  const logo = document.getElementById('bar-logo');
  document.body.dataset.season = theme;
  if (!logo) return;
  const src = theme === 'natale' ? '../assets/logo-natale-256.webp' : '../assets/logo-192.webp';
  if (logo.getAttribute?.('src') !== src) logo.src = src;
  logo.alt = theme === 'natale' ? 'Logo natalizio Bar La Lucciola' : 'Logo Bar La Lucciola';
}
function applyScheduledContent(today = venueDateKey()) {
  const banner = document.getElementById('alert-banner');
  if (banner) {
    const notices = scheduledNotices.filter(row => isScheduledRowActive(row, today));
    banner.textContent = notices.map(row => row.descrizione ? `${row.nome} - ${row.descrizione}` : row.nome).join(' • ');
    banner.style.display = notices.length ? 'inline-flex' : 'none';
    banner.classList.add('festive-badge');
  }
  // URL override remains available for testing either theme without changing Sheets.
  const requested = new URLSearchParams(window.location?.search || '').get('tema');
  const theme = ['normale', 'natale'].includes(requested) ? requested : themeForRows(themeSettings, today);
  updateBrandLogo(theme);
  const existing = document.getElementById('seasonal-theme');
  if (theme === 'natale' && !existing) {
    const link = document.createElement('link');
    link.id = 'seasonal-theme'; link.rel = 'stylesheet'; link.href = 'themes/natale.css?v=20261011-1';
    document.head.appendChild(link);
  } else if (theme === 'normale' && existing) existing.remove();
}
function initDataFetch(useCache = true) {
  if (menuFetchInProgress) return;
  if (useCache) {
    try {
      const cached = JSON.parse(storage.getItem('menuDataCacheV3:' + SHEET_URL));
      if (Array.isArray(cached?.rows)) {
        transformCsvToMenu(cached.rows);
        previousMenuRows = JSON.stringify(cached.rows);
        restoreMenuView();
        menuNotice('Menù salvato: verifico gli aggiornamenti…');
      }
    } catch (_) {}
  }
  const failed = () => {
    menuFetchInProgress = false;
    menuNotice(Object.keys(menuData).length ? 'Aggiornamento non disponibile. Stai consultando il menù salvato; prezzi e disponibilità potrebbero essere cambiati.' : 'Menù non disponibile. Riprova ricaricando la pagina.');
  };
  if (typeof Papa === 'undefined') { failed(); return; }
  menuFetchInProgress = true;
  if (!Object.keys(menuData).length) menuNotice('Caricamento del menù…');
  Papa.parse(SHEET_URL, {
    download: true, header: true, skipEmptyLines: true, transform: safeTrim,
    complete(results) {
      try {
        validateMenuResults(results);
        const serialized = JSON.stringify(results.data);
        if (serialized !== previousMenuRows) {
          transformCsvToMenu(results.data);
          restoreMenuView();
          previousMenuRows = serialized;
        } else applyScheduledContent();
        storage.setItem('menuDataCacheV3:' + SHEET_URL, JSON.stringify({rows: results.data}));
        menuFetchInProgress = false;
        menuNotice('');
      } catch (_) { failed(); }
    },
    error: failed
  });
}

function transformCsvToMenu(csvData) {
  menuData = {};
  scheduledNotices = [];
  themeSettings = [];
  csvData.forEach((row) => {
    if (!row?.categoria || !row?.nome) return;
    const category = safeTrim(row.categoria).toUpperCase();
    if (category === 'IMPOSTAZIONE') {
      if (safeTrim(row.nome).toLowerCase() === 'tema') themeSettings.push(row);
      return;
    }
    if (category.includes('AVVISO')) {
      scheduledNotices.push(row);
      return;
    }

    // Filtra elementi disabilitati
    if (isFalseLike(row.disponibile)) return;

    const catKey = normalizeCategory(row.categoria);

    if (!menuData[catKey]) {
      menuData[catKey] = {
        title: CATEGORY_TITLES[catKey] || row.categoria,
        items: []
      };
    }

    const allergensList = row.allergeni
      ? String(row.allergeni)
          .split(',')
          .map((s) => safeTrim(s).toLowerCase())
          .filter(Boolean)
      : [];

    menuData[catKey].items.push({
      name: row.nome,
      price: parsePrice(row.prezzo),
      description: row.descrizione || '',
      allergens: allergensList,
      tag: safeTrim(row.tag).toLowerCase(),
      tipo: safeTrim(row.tipo).toLowerCase(),
      subcategory: row.categoria, // mantiene capitalizzazione originale
      soldOut: isSoldOutLike(row.disponibile)
    });
  });
  applyScheduledContent();
}

function normalizeCategory(catString) {
  const c = String(catString || '').toLowerCase();

  // Cerca prima Aperitivi
  if (
    c.includes('aperitiv') ||
    c.includes('spritz') ||
    c.includes('cocktail') ||
    c.includes('prosecco') ||
    c.includes('long drink')
  ) {
    return 'aperitivi';
  }

  if (c.includes('caff') || c.includes('cald') || c.includes('tè') || c.includes('tisane')) return 'calde';
  if (c.includes('fredd') || c.includes('bibit') || c.includes('succh') || c.includes('acqu')) return 'fredde';

  if (
    c.includes('alcol') ||
    c.includes('vin') ||
    c.includes('birr') ||
    c.includes('amar') ||
    c.includes('liquor') ||
    c.includes('grap')
  ) {
    return 'alcolici';
  }

  if (
    c.includes('cib') ||
    c.includes('food') ||
    c.includes('panin') ||
    c.includes('snack') ||
    c.includes('taglier') ||
    c.includes('focacc')
  ) {
    return 'food';
  }

  if (c.includes('dolc') || c.includes('dessert') || c.includes('gelat') || c.includes('tort')) return 'dolci';

  return 'altro';
}

/* ===========================
   UI: WIFI MODAL
   =========================== */
async function copyWifiPassword() {
  const password = document.getElementById('wifi-password')?.textContent.trim();
  const feedback = document.getElementById('wifi-copy-status');
  if (!password || !feedback) return;
  try {
    await navigator.clipboard.writeText(password);
    feedback.textContent = 'Password copiata!';
  } catch (_) {
    feedback.textContent = 'Tieni premuta la password per selezionarla e copiarla.';
  }
}

function openWifi() {
  const modal = document.getElementById('wifi-modal');
  if (!modal || modal.open) return;
  const feedback = document.getElementById('wifi-copy-status');
  if (feedback) feedback.textContent = '';
  document.body.classList.add('wifi-open');
  modal.showModal();
  modal.classList.add('active');
  modal.querySelector('.close-modal')?.focus();
}
function closeWifi(event) {
  const modal = document.getElementById('wifi-modal');
  if (!modal) return;
  if (event && event.target !== modal && !event.target.closest?.('.close-modal')) return;
  modal.close();
  modal.classList.remove('active');
  document.body.classList.remove('wifi-open');
}
document.getElementById('wifi-modal')?.addEventListener('close', () => {
  document.body.classList.remove('wifi-open');
  document.getElementById('wifi-modal')?.classList.remove('active');
});
function updateCategoryArrows() {
  const buttons = Array.from(document.querySelectorAll('.nav-scroll-area .tab-btn'));
  const selected = buttons.findIndex(button => button.classList.contains('active'));
  const prev = document.getElementById('category-prev');
  const next = document.getElementById('category-next');
  if (prev) prev.disabled = selected <= 0;
  if (next) next.disabled = selected < 0 || selected >= buttons.length - 1;
}
function scrollCategories(direction) {
  const buttons = Array.from(document.querySelectorAll('.nav-scroll-area .tab-btn'));
  const selected = buttons.findIndex(button => button.classList.contains('active'));
  const target = selected + Math.sign(direction);
  if (selected < 0 || target < 0 || target >= buttons.length || !direction) return;
  const button = buttons[target];
  const category = getActiveCategoryFromOnclick(button);
  if (category) showCategory(category, button);
}
function clearMenuSearch() {
  const input = document.getElementById('menu-search');
  if (!input) return;
  input.value = '';
  searchMenu();
  input.focus();
}

/* ===========================
   SCROLL / NAV / BACK-TO-TOP
   =========================== */
let lastScrollTop = 0;
const navContainer = document.querySelector('.sticky-nav-container');
const backToTopBtn = document.getElementById('back-to-top');
const scrollDelta = 10;

window.addEventListener(
  'scroll',
  () => {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    const searchInput = document.getElementById('menu-search');

// Se stai scrivendo e inizi a scrollare: chiudi subito la ricerca
if (document.activeElement === searchInput) {
  searchInput.blur(); // chiude tastiera + toglie focus
  navContainer?.classList.remove('nav-hidden'); // opzionale: evita sparizioni “brusche”
  if (window.syncSearchExpanded) window.syncSearchExpanded(); // richiude (toglie expanded)
  // NON fare return: lascia proseguire la logica di hide/show nav
}
     
    // Ignora tremolii
    if (Math.abs(lastScrollTop - currentScroll) <= scrollDelta) return;

    if (currentScroll > lastScrollTop && currentScroll > 150) {
      navContainer?.classList.add('nav-hidden');
    } else {
      if (currentScroll < 350) navContainer?.classList.remove('nav-hidden');
    }

    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;

    if (backToTopBtn) {
      backToTopBtn.style.display = currentScroll > 300 ? 'flex' : 'none';
    }
  },
  { passive: true }
);

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===========================
   STATUS (APERTURA) - da CSV
   =========================== */
function checkOpenStatus() {
  const el = document.getElementById('status-indicator');
  if (!el) return;

  if (hoursSource !== 'live' || !openingSchedule) {
    el.textContent = hoursSource === 'loading' ? 'Verifico gli orari' : 'Orari da verificare';
    el.classList.remove('open', 'closed');
    return;
  }
  const isOpen = isOpenNow(venueNow());

  if (isOpen) {
    el.innerHTML = `<span class="status-dot"></span> Aperto`;
    el.classList.add('open');
    el.classList.remove('closed');
  } else {
    el.innerHTML = `<span class="status-dot"></span> Chiuso`;
    el.classList.add('closed');
    el.classList.remove('open');
  }
}

/* ===========================
   METEO
   =========================== */
async function fetchWeather() {
  const weatherEl = document.getElementById('weather-indicator');
  if (!weatherEl) return;

  const lat = 40.8106;
  const lon = 15.1127;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const temp = Math.round(data.current_weather.temperature);
    const code = data.current_weather.weathercode;

    let iconSvg;

    // reset classi speciali
    weatherEl.classList.remove('snow');

    if (code <= 1) {
      iconSvg =
        `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    } else if (code <= 3) {
      iconSvg = `<svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`;
    } else if (code === 45 || code === 48) {
      iconSvg = `<svg viewBox="0 0 24 24"><path d="M5 12h14"></path><path d="M5 16h14"></path><path d="M5 20h14"></path><path d="M5 8h14"></path></svg>`;
    } else if (code >= 71 && code <= 77) {
      iconSvg =
        `<svg viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><path d="m20 16-4-4 4-4"></path><path d="m4 8 4 4-4 4"></path><path d="m16 4-4 4-4-4"></path><path d="m8 20 4-4 4 4"></path></svg>`;
      weatherEl.classList.add('snow');
    } else if (code >= 95) {
      iconSvg =
        `<svg viewBox="0 0 24 24"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path><polyline points="13 11 9 17 15 17 11 23"></polyline></svg>`;
    } else {
      iconSvg =
        `<svg viewBox="0 0 24 24"><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`;
    }

    weatherEl.innerHTML = `${iconSvg} ${temp}°C`;
    weatherEl.style.display = 'inline-flex';
  } catch (e) {
    console.log('Meteo non disponibile');
  }
}

/* ===========================
   LITE MODE BUTTON
   =========================== */
function toggleLiteMode() {
  const body = document.body;
  const btn = document.getElementById('lite-switch');
  if (!btn) return;

  // Toggle classe
  const isLite = body.classList.toggle('lite-mode');

  // Salva preferenza PER SEMPRE (così se torno domani si ricorda)
storage.setItem(PREVIEW_VIEW_KEY, isLite ? 'true' : 'false');
if (window.history?.replaceState) {
  const url = new URL(window.location.href);
  url.searchParams.set('vista', isLite ? 'essenziale' : 'normale');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

  // Aggiorna icona
  updateLiteButton(btn, isLite);
}

function updateLiteButton(btn, isLite) {
  btn.setAttribute('aria-label', isLite ? 'Torna alla vista completa' : 'Attiva vista essenziale');
  btn.setAttribute('aria-pressed', String(isLite));
  if (!isLite) {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
        <path d="M13 2L3 14h7l-1 8L21 10h-7l-1-8z"></path>
      </svg>
      <span>Essenziale</span>
    `;
  } else {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
        <line x1="6" y1="1" x2="6" y2="4"></line>
        <line x1="10" y1="1" x2="10" y2="4"></line>
        <line x1="14" y1="1" x2="14" y2="4"></line>
      </svg>
      <span>Completa</span>
    `;
  }
}

/* ===========================
   MENU UI
   =========================== */
function revealCategoryButton(btn) {
  const rail = btn?.closest?.('.nav-scroll-area');
  if (!rail || rail.scrollWidth <= rail.clientWidth) return;
  const buttons = Array.from(rail.querySelectorAll('.tab-btn'));
  const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
  let left;
  if (btn === buttons[0]) {
    left = 0;
  } else if (btn === buttons[buttons.length - 1]) {
    left = maxScroll;
  } else {
    const buttonRect = btn.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    left = rail.scrollLeft + buttonRect.left - railRect.left - rail.clientLeft
      - (rail.clientWidth - buttonRect.width) / 2;
    left = Math.max(0, Math.min(maxScroll, left));
  }
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Scroll this rail only, without moving the page or footer.
  rail.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
}

const CATEGORY_CAPTIONS = {
  calde: 'Una pausa tra le montagne',
  fredde: 'Un sorso di freschezza',
  aperitivi: 'Il gusto di stare insieme',
  alcolici: 'Da gustare con calma',
  food: 'Qualcosa di buono per la tua pausa',
  dolci: 'Il lato dolce della montagna'
};
function categoryHeading(title, category) {
  const caption = CATEGORY_CAPTIONS[category];
  const chapter = String(Venue.categories.indexOf(category) + 1).padStart(2, '0');
  return `<div class="category-heading"><div><p class="eyebrow">IL MENÙ DELLA LUCCIOLA</p><h2>${escapeHtml(title)}</h2>${caption ? `<p class="category-caption">${escapeHtml(caption)}</p>` : ''}</div><span class="chapter" aria-hidden="true">${chapter}<small> / 06</small></span></div>`;
}
function syncCategoryAccessibility() {
  document.querySelectorAll('.tab-btn').forEach(button => {
    const active = button.classList.contains('active');
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

function showCategory(catId, btnElement) {
  if (!Venue.categories.includes(catId)) return;
  if (btnElement && window.history?.replaceState) {
    const url = new URL(window.location.href);
    url.searchParams.set('categoria', catId);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  const isLite = document.body.classList.contains('lite-mode');
  const searchInput = document.getElementById('menu-search');
  if (searchInput) searchInput.value = '';

   if (window.syncSearchExpanded) window.syncSearchExpanded();

  if (btnElement) {
    const nav = document.querySelector('.sticky-nav-container');
    const main = document.getElementById('menu-main');
    if (main && nav && window.scrollY > main.offsetTop - nav.offsetHeight) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.max(0, main.offsetTop - nav.offsetHeight - 16), behavior: reduced || isLite ? 'auto' : 'smooth' });
    }
  }
   
  const container = document.getElementById('menu-container');
  const data = menuData[catId];

 let targetBtn = btnElement;

 // Se non mi passi il bottone, lo cerco in base alla categoria
 if (!targetBtn) {
   targetBtn = Array.from(document.querySelectorAll('.tab-btn'))
     .find((b) => getActiveCategoryFromOnclick(b) === catId);
 }

 if (targetBtn) {
   document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
   targetBtn.classList.add('active');
   syncCategoryAccessibility();
   revealCategoryButton(targetBtn);
   updateCategoryArrows();
 }


  if (!container) return;
  if (!data || !data.items.length) {
    container.innerHTML = categoryHeading(CATEGORY_TITLES[catId] || 'Menù', catId) + '<p class="empty-menu">Nessun prodotto disponibile in questa categoria.</p>';
    return;
  }

  container.innerHTML = categoryHeading(data.title, catId);

  const subcats = [...new Set(data.items.map((i) => i.subcategory))];

  if (subcats.length <= 1) {
    renderItems(data.items, container, isLite);
    return;
  }

  subcats.sort((a, b) => {
    const idxA = PREFERRED_SUBCAT_ORDER.indexOf(a);
    const idxB = PREFERRED_SUBCAT_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  subcats.forEach((sub) => {
    const isRedundant =
      sub.toLowerCase() === data.title.toLowerCase() ||
      (catId === 'fredde' && sub.toLowerCase() === 'bibite');

    if (!isRedundant) {
      container.innerHTML += `<h3 class="subcategory-title">${escapeHtml(sub)}</h3>`;
    }

    const groupItems = data.items.filter((i) => i.subcategory === sub);
    renderItems(groupItems, container, isLite, true);
  });
}

function searchMenu() {
  const searchInput = document.getElementById('menu-search');
  if (!searchInput) return;

  const filter = searchInput.value.toLowerCase();
  const container = document.getElementById('menu-container');
  if (!container) return;

  if (filter.length === 0) {
    const activeBtn = document.querySelector('.tab-btn.active');
    const catId = getActiveCategoryFromOnclick(activeBtn);
    if (activeBtn && catId) showCategory(catId, activeBtn);
    return;
  }

  let allMatches = [];
  for (const category of Object.values(menuData)) {
    const matches = category.items.filter((item) => item.name.toLowerCase().includes(filter));
    allMatches = allMatches.concat(matches);
  }

  container.innerHTML = `<div class="category-heading"><div><p class="eyebrow">TROVA LA TUA PAUSA</p><h2>Risultati ricerca <span class="search-count">(${allMatches.length})</span></h2><p class="category-caption">Cerchiamo in tutte le categorie del menù.</p></div></div>`;
  if (!allMatches.length) {
    container.innerHTML += '<div class="search-empty"><p>Nessun prodotto trovato. Prova con un altro nome.</p><button type="button" data-action="clear-search">Cancella ricerca</button></div>';
    return;
  }
  renderItems(allMatches, container, document.body.classList.contains('lite-mode'));
}

function renderItems(items, container, isLite, grouped = false) {
  items.forEach((item, index) => {
    const price = Number.isFinite(item.price) && item.price >= 0 ? '€ ' + item.price.toFixed(2).replace('.', ',') : 'Prezzo da verificare';
    const descHTML = item.description ? `<p>${escapeHtml(item.description)}</p>` : '';

    let tagHTML = '';
    if (item.tag === 'new') tagHTML = `<span class="tag-badge tag-new">Novità</span>`;
    if (item.tag === 'hot') tagHTML = `<span class="tag-badge tag-hot">Top</span>`;

    if (item.tag === 'aperitivo' && ['alcolico', 'analcolico'].includes(item.tipo)) tagHTML += `<span class="tag-badge tag-aperitivo">Aperitivo ${escapeHtml(item.tipo)}</span>`;

    let allergensHTML = '';
    if (item.allergens?.length) {
      allergensHTML = `<div class="allergen-row">`;
      item.allergens.forEach((a) => {
        const data = allergenMap[a];
        if (data) allergensHTML += `<span class="allergen-tag">${data.label}</span>`;
      });
      allergensHTML += `</div>`;
    }

    container.innerHTML += `
      <article class="menu-item ${item.soldOut ? 'sold-out' : ''}" style="animation-delay: ${isLite ? 0 : Math.min(index, 4) * 0.025}s">
        <div class="item-info">
          <${grouped ? 'h4' : 'h3'}>${escapeHtml(item.name)} ${tagHTML}</${grouped ? 'h4' : 'h3'}>
          ${item.soldOut ? '<span class="availability-label">Terminato</span>' : ''}
          ${descHTML}
          ${allergensHTML}
        </div>
        <div class="item-price">${price}</div>
      </article>
    `;
  });
}

/* ===========================
   BOOTSTRAP
   =========================== */
document.addEventListener('DOMContentLoaded', () => {

   const searchInput = document.getElementById('menu-search');
  const searchWrapper = searchInput?.closest('.search-input-wrapper');

function syncSearchExpanded() {
  if (!searchInput || !searchWrapper) return;
  const hasText = searchInput.value.trim().length > 0;
  const isFocused = document.activeElement === searchInput;
  searchWrapper.classList.toggle('expanded', hasText || isFocused);
}

if (searchInput && searchWrapper) {
  searchInput.addEventListener('input', syncSearchExpanded);
  searchInput.addEventListener('focus', syncSearchExpanded);
  searchInput.addEventListener('blur', syncSearchExpanded);
  syncSearchExpanded();
}

// se vuoi richiamarla anche da altre funzioni:
window.syncSearchExpanded = syncSearchExpanded;
  const categoryArea = document.querySelector('.nav-scroll-area');
  categoryArea?.addEventListener('scroll', updateCategoryArrows, {passive: true});
  window.addEventListener('resize', updateCategoryArrows);
  if (categoryArea && typeof ResizeObserver !== 'undefined') new ResizeObserver(updateCategoryArrows).observe(categoryArea);
  updateCategoryArrows();
  const requestedCategory = Venue.categoryFromSearch(window.location?.search || '');
  if (requestedCategory) showCategory(requestedCategory, null);
  document.addEventListener('keydown', event => {
    const modal = document.getElementById('wifi-modal');
    if (!modal?.classList.contains('active')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeWifi(); }
    if (event.key === 'Tab') {
      const controls = Array.from(modal.querySelectorAll('button, a[href], input')).filter(control => !control.disabled && !control.hidden && control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  const requestedView = new URLSearchParams(window.location?.search || '').get('vista');
  const userLite = storage.getItem(PREVIEW_VIEW_KEY);
  if (requestedView === 'normale' || requestedView === 'essenziale') document.body.classList.toggle('lite-mode', requestedView === 'essenziale');
  else if (userLite !== null) document.body.classList.toggle('lite-mode', userLite === 'true');
  updateBrandLogo(new URLSearchParams(window.location?.search || '').get('tema') === 'natale' ? 'natale' : 'normale');
  // Orari + tabella + status (da CSV)
  initOpeningHours();

  // Meteo + menu
  fetchWeather();
  initDataFetch();

  // Aggiorna badge aperto/chiuso ogni minuto (senza refresh)
  setInterval(() => { checkOpenStatus(); applyScheduledContent(); }, 60 * 1000);
  // Refresh only in visible tabs, preserving the selected category and search.
  setInterval(() => { if (!document.hidden) { initDataFetch(false); initOpeningHours(); } }, 2 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { applyScheduledContent(); initDataFetch(false); initOpeningHours(); }
  });

  // Bottone lite: allinea l'icona allo stato reale del body
  const btn = document.getElementById('lite-switch');
  const isLiteNow = document.body.classList.contains('lite-mode');
  if (btn) updateLiteButton(btn, isLiteNow);
   
});

// Event delegation keeps executable code out of HTML attributes.
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-action]');
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case 'review-open': document.getElementById('review-dialog')?.showModal(); break;
    case 'review-close': document.getElementById('review-dialog')?.close(); break;
    case 'lite': toggleLiteMode(); break;
    case 'wifi-open': openWifi(); break;
    case 'wifi-close': closeWifi(event); break;
    case 'wifi-copy': copyWifiPassword(); break;
    case 'category-prev': scrollCategories(-1); break;
    case 'category-next': scrollCategories(1); break;
    case 'category': showCategory(button.dataset.cat, button); break;
    case 'top': scrollToTop(); break;
    case 'clear-search': clearMenuSearch(); break;
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'menu-search') searchMenu();
});

// Il dialog nativo gestisce Escape, focus e navigazione da tastiera.
document.getElementById('review-dialog')?.addEventListener('click', event => {
  const dialog = event.currentTarget;
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});


// Keyboard tabs work without changing the category rail's width.
document.querySelector('.nav-scroll-area')?.addEventListener('keydown', event => {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const current = buttons.indexOf(event.target.closest('.tab-btn'));
  if (current < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
  if (index !== current) { showCategory(buttons[index].dataset.cat, buttons[index]); buttons[index].focus({preventScroll:true}); }
});
