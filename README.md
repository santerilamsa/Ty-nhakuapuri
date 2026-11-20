# Työnhakuapuri

Selainsovellus harjoittelupaikkojen keräämiseen ja hakemusten tilan seurantaan.
MCP-palvelin antaa tekoälyagentille työkalut (`etsi_paikat`, `tallenna_hakemus`, `muistuta`, …)
ja frontendissä on kanban-näkymä hakemuksista.

Suunnitelma: [SUUNNITELMA.md](SUUNNITELMA.md)

## Rakenne

```
packages/core   palvelukerros + SQLite
packages/mcp    MCP-palvelin
packages/api    REST API
apps/web        React-kanban
```

## Tila

Vaihe 0: projektin pohja työn alla.

## Kehitys

```
npm install
npm run build -w @tyonhakuapuri/core
npm run dev -w @tyonhakuapuri/web   # http://localhost:5173
```

API (`packages/api`) pitää käynnistää erikseen (`npm run build -w @tyonhakuapuri/api && npm start -w @tyonhakuapuri/api`, portti 3001); web välittää `/api`-kutsut sinne.
