# Sito web Bar La Lucciola

Bozza indipendente del sito del bar al Laceno, con menù digitale verde bosco.

## Struttura
- `index.html`: presentazione, galleria e contatti.
- `menu/`: menù completo, avvisi, tema Natale, ricerca e recensioni.
- `menu/images/`: immagini del locale e loghi.
- `_headers`: intestazioni per hosting compatibili.

## Dati
Il menù legge il nuovo foglio Google pubblicato, scheda Dati sito. Gli orari mantengono il precedente CSV fino alla comunicazione del nuovo collegamento. Le sorgenti sono configurate in `assets/site-core.js`.

## Anteprima locale
Dalla cartella principale: `python -m http.server 8000`, poi aprire http://localhost:8000.

## Verifiche
`node --test menu/tests/menu.test.cjs`

Il caricamento su GitHub non attiva la pubblicazione ufficiale. Prima del lancio confermare testi, servizi e informativa privacy per l’hosting scelto.

Design by Giandomenico Nigro.

## Aggiornamento 4 novembre 2026
- Home e menù condividono colori, caratteri, pulsanti e navigazione di ritorno.
- Collegamenti alle categorie: `menu/?categoria=calde`, `fredde`, `aperitivi`, `alcolici`, `food`, `dolci`.
- Configurazione e logica orari condivise in `assets/site-core.js`. I dati incompleti o non validi non vengono presentati come orari verificati. In assenza di rete viene segnalata l'eventuale copia salvata.
- Immagini WebP responsive in `assets/`; originali conservati in `menu/images/`.
- La home usa solo script e caratteri locali. I dati del foglio vengono trattati come contenuto non attendibile.
- Test: `node --test assets/site-core.test.cjs menu/tests/menu.test.cjs`.
- Pubblicazione ufficiale ancora da completare. Gli orari usano il CSV già configurato fino alla consegna del nuovo collegamento.
