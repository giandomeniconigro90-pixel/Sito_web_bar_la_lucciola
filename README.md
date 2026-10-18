# Sito web Bar La Lucciola

Bozza indipendente del sito del bar al Laceno, con menù digitale verde bosco.

## Struttura
- `index.html`: presentazione, galleria e contatti.
- `menu/`: menù completo, avvisi, tema Natale, ricerca e recensioni.
- `menu/images/`: immagini del locale e loghi.
- `_headers`: intestazioni per hosting compatibili.

## Dati
Il menù legge il nuovo foglio Google pubblicato, scheda Dati sito. Gli orari mantengono il precedente CSV fino alla comunicazione del nuovo collegamento. Le sorgenti sono configurate in `menu/script.js`.

## Anteprima locale
Dalla cartella principale: `python -m http.server 8000`, poi aprire http://localhost:8000.

## Verifiche
`node --test menu/tests/menu.test.cjs`

Il caricamento su GitHub non attiva la pubblicazione ufficiale. Prima del lancio confermare testi, servizi e informativa privacy per l’hosting scelto.

Design by Giandomenico Nigro.
