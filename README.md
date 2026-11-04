# Bar La Lucciola — sito e menù

La prima proposta di menù è stata scelta da Giandomenico e adottata in `menu/`. Home, menù e pagina privacy condividono crema, verde bosco, caratteri, larghezze, testata, footer e icone social. La pubblicazione ufficiale resta per una fase successiva.

## Pagine e risorse
- `index.html`, `site.css`, `home.js`: presentazione del bar, galleria, contatti e orari.
- `menu/index.html`, `menu/menu.css`, `menu/menu.js`, `menu/view-init.js`: menù scelto, vista normale/essenziale, ricerca, categorie, allergeni, disponibilità, Wi-Fi e scelta piattaforma recensioni.
- `menu/themes/natale.css`: variante stagionale scelta, con logo e programmazione dal foglio.
- `assets/site-theme.css`, `assets/site-shell.css`: identità e struttura comuni delle pagine attive.
- `assets/site-core.js`: configurazione e logica degli orari, con validazione e gestione della copia salvata.
- `menu/vendor/`: caratteri e libreria CSV ospitati localmente; `assets/`: immagini ottimizzate. Originali in `menu/images/`.
- [BOZZE_MENU.md](BOZZE_MENU.md): tutte le alternative conservate, comprese Carta, Bosco e Banco.

## Dati e sicurezza
Le sorgenti Google Fogli sono in `assets/site-core.js`. Gli orari mantengono il CSV precedente fino alla consegna di un nuovo collegamento. Dati incompleti o non validi non vengono presentati come orari verificati. Le preferenze di visualizzazione sono separate per percorso.

`_headers` contiene le intestazioni di sicurezza per hosting compatibili. Prima del lancio ufficiale verificare la loro applicazione sull'hosting scelto e completare dati del titolare, dettagli hosting e informativa privacy. Le pagine attive della bozza hanno `noindex,nofollow`, che non sostituisce il controllo degli accessi dell'anteprima privata.

## Prove
Dalla radice della repository:

```sh
LUCCIOLA_MENU_SCRIPT="$PWD/menu/menu.js" node --test assets/site-core.test.cjs menu/tests/menu.test.cjs menu-bozza/tests/menu-preview.test.cjs
```

24 test automatici superati sull'implementazione scelta e sulle funzioni condivise. Controlli visivi e funzionali su desktop, telefono (320 e 390 px) e tablet. Restano opportune prove su Safari/iPhone e dispositivi reali prima del lancio.

I precedenti `menu/script.js` e `menu/style.css` sono conservati per consultazione e regressione; la pagina attiva carica `menu/menu.js` e `menu/menu.css`.

Design by Giandomenico Nigro.
