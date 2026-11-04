(function () {
  'use strict';
  const site = window.LucciolaSite;
  const navButton = document.querySelector('.nav-toggle');
  const navLinks = document.getElementById('nav-links');
  function closeNavigation() {
    navButton.setAttribute('aria-expanded', 'false'); navLinks.classList.remove('is-open');
  }
  navButton.addEventListener('click', () => {
    const open = navButton.getAttribute('aria-expanded') !== 'true';
    navButton.setAttribute('aria-expanded', String(open)); navLinks.classList.toggle('is-open', open);
  });
  navLinks.addEventListener('click', event => { if (event.target.closest('a')) closeNavigation(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navButton.getAttribute('aria-expanded') === 'true') { closeNavigation(); navButton.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('nav')) closeNavigation(); });
  const modal = document.getElementById('photo');
  const modalImage = modal.querySelector('img');
  document.querySelectorAll('[data-photo]').forEach(button => {
    button.addEventListener('click', () => {
      modalImage.src = button.dataset.photo; modalImage.alt = button.querySelector('img').alt; modal.showModal();
    });
  });
  modal.querySelector('button').addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
  });
  modal.addEventListener('close', () => modalImage.removeAttribute('src'));
  let currentHours = { schedule: null, source: 'loading' };
  let request = null;
  function renderHours() {
    const now = site.venueNow(), day = now.getDay(), result = currentHours;
    const live = result.source === 'live', open = live ? site.isOpenNow(result.schedule, now) : null;
    document.querySelectorAll('[data-hours-status]').forEach(element => {
      element.textContent = live ? (open ? 'Aperto ora' : 'Chiuso ora') : result.source === 'loading' ? 'Verifico gli orari' : 'Orari da verificare';
      element.dataset.state = live ? (open ? 'open' : 'closed') : 'unknown';
    });
    document.querySelector('[data-today-hours]').textContent = result.schedule ? 'Oggi: ' + site.formatDaySlots(result.schedule[day]) : 'Consulta gli orari';
    document.querySelector('[data-hours-source]').textContent = live ? 'Orario locale di Laceno. Per variazioni straordinarie, chiamaci.' : result.source === 'cache' ? 'Ultimi orari salvati. Chiama per conferma.' : result.source === 'loading' ? 'Caricamento degli orari…' : 'Non riesco a verificare gli orari. Chiama 0827 68069.';
    const table = document.getElementById('home-hours'); table.replaceChildren();
    if (!result.schedule) return;
    const names = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    [1, 2, 3, 4, 5, 6, 0].forEach(index => {
      const row = document.createElement('tr'), label = document.createElement('th'), value = document.createElement('td');
      label.scope = 'row'; label.textContent = names[index]; value.textContent = site.formatDaySlots(result.schedule[index]);
      if (index === day) { row.className = 'is-today'; label.textContent += ' · oggi'; }
      row.append(label, value); table.append(row);
    });
  }
  function refreshHours() {
    if (request) return request;
    let storage = null; try { storage = window.localStorage; } catch (_) {}
    request = site.loadHours(window.Papa, storage).then(result => { currentHours = result; renderHours(); }).finally(() => { request = null; });
    return request;
  }
  renderHours(); refreshHours();
  setInterval(renderHours, 60000);
  setInterval(() => { if (!document.hidden) refreshHours(); }, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderHours(); refreshHours(); } });
})();
