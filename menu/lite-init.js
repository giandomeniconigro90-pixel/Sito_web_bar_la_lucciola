(function () {
  // La scelta manuale ha precedenza sul risparmio dati del browser.
  var saved = null;
  try { saved = localStorage.getItem('liteModeUser'); } catch (_) {}
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var isLite = saved !== null ? saved === 'true' : !!(connection && connection.saveData);
  document.body.classList.toggle('lite-mode', isLite);
})();
