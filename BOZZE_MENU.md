# Bozze dei menù — Bar La Lucciola

Tutte le proposte sono conservate in questa repository. Nessuna proposta sostituisce il menù principale fino alla conferma di Giandomenico.

| Proposta | Cartella del codice | Anteprima normale | Anteprima essenziale |
| --- | --- | --- | --- |
| Prima proposta | [menu-bozza](menu-bozza/) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-bozza/?vista=normale) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-bozza/?vista=essenziale) |
| 01 · Carta | [menu-carta](menu-carta/) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-carta/?vista=normale) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-carta/?vista=essenziale) |
| 02 · Bosco | [menu-bosco](menu-bosco/) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-bosco/?vista=normale) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-bosco/?vista=essenziale) |
| 03 · Banco | [menu-banco](menu-banco/) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-banco/?vista=normale) | [Apri](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-banco/?vista=essenziale) |

[Pagina di confronto delle tre nuove proposte](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-proposte/).

Le anteprime ospitate sono private e richiedono l'account ChatGPT autorizzato.

## Proposta indicata per l'utilizzo al tavolo

Il 4 novembre 2026 Giandomenico ha indicato anche la prima proposta come possibile preferenza per l'utilizzo pratico. La scelta finale resta aperta; Bosco rimane una proposta apprezzata.

[Prima proposta, categoria aperitivi in vista normale](https://lucciola-bozza-ottobre.giandomenico-nigro90.chatgpt.site/menu-bozza/?vista=normale&categoria=aperitivi).

## Funzioni e dipendenze conservate

- Tutte le proposte leggono gli stessi prodotti, prezzi, allergeni, disponibilità e avvisi.
- Vista normale ed essenziale condividono il codice e si selezionano con `vista=normale` o `vista=essenziale`.
- Il tema natalizio si attiva secondo le date del foglio. Per provarlo si può aggiungere `tema=natale`; `tema=normale` forza quello normale.
- Le categorie si possono aprire con `categoria=calde`, `fredde`, `aperitivi`, `alcolici`, `food` o `dolci`.
- Le tre nuove proposte usano il motore comune in `menu-bozza/menu.js`, gli stili base di `menu-bozza/menu.css`, `menu-bozza/view-init.js`, `assets/` e le librerie/caratteri locali in `menu/vendor/`. Occorre conservare queste dipendenze insieme alle cartelle delle proposte.
- Le varianti natalizie sono conservate nelle rispettive cartelle `themes/`.
- Gli screenshot delle proposte sono in `menu-bozza/anteprima.jpg` e `menu-proposte/confronto.jpg`.

Il menù principale resta in [menu](menu/) e la home continua a collegarsi a quello.

## Verifiche

```sh
node --test assets/site-core.test.cjs menu/tests/menu.test.cjs menu-bozza/tests/menu-preview.test.cjs
```

Le ultime verifiche sulle proposte hanno superato 24 test automatici, oltre ai controlli visivi e funzionali sulle larghezze provate. Non equivalgono a una prova su ogni dispositivo reale.
