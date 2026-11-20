# Työnhakuapuri

Selainsovellus harjoittelupaikkojen keräämiseen ja hakemusten tilan seurantaan.
MCP-palvelin antaa tekoälyagentille työkalut (`etsi_paikat`, `tallenna_hakemus`, `muistuta`, …)
ja frontendissä on kanban-näkymä hakemuksista.

Suunnitelma: [SUUNNITELMA.md](SUUNNITELMA.md)

## Rakenne (suunniteltu)

```
packages/core   palvelukerros + SQLite
packages/mcp    MCP-palvelin
packages/api    REST API
apps/web        React-kanban
```

## Tila

Vaihe 0: projektin pohja työn alla.
