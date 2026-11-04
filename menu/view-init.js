(function () {
 const query = new URLSearchParams(location.search).get('vista');
 let saved = null;
 try { saved = localStorage.getItem('lucciola:preview:lite:' + location.pathname); } catch (_) {}
 document.body.classList.toggle('lite-mode', query === 'essenziale' || (query !== 'normale' && saved === 'true'));
})();
