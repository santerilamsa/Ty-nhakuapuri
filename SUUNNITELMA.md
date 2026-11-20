# Työnhakuapuri – suunnitelma

Selainsovellus harjoittelupaikkojen keräämiseen ja hakemusten tilan seurantaan.
MCP-palvelin antaa tekoälyagentille työkalut (`etsi_paikat`, `tallenna_hakemus`, `muistuta`, …),
ja frontendissä on kanban-näkymä hakemuksista.

## 1. Tavoite ja rajaus

**Ongelma:** Harjoittelupaikkoja ja hakemuksia on hajallaan (ilmoitukset, sähköpostit, muistiinpanot) ja deadlinet unohtuvat.

**Tavoite (MVP):**
1. Tallennan paikan yhdellä komennolla (agentille tai lomakkeella).
2. Näen kaikki hakemukset kanbanissa ja siirrän niitä tilasta toiseen.
3. Agentti muistuttaa lähestyvistä deadlineista ja seuraamatta jääneistä hakemuksista.

**Ei MVP:ssa:** käyttäjätilit/kirjautuminen, usean käyttäjän tuki, sähköpostin automaattinen luku, automaattinen hakeminen.
Sovellus on henkilökohtainen ja pyörii paikallisesti.

## 2. Arkkitehtuuri

```
        ┌──────────────┐   stdio/MCP    ┌─────────────────┐
        │ Agentti      │◄──────────────►│  MCP-palvelin   │
        │ (Claude yms.)│                │  (työkalut)     │
        └──────────────┘                └────────┬────────┘
                                                 │ käyttää
                                        ┌────────▼────────┐
 ┌──────────────┐   HTTP/JSON  ┌────────┤  core (palvelu- │
 │ Frontend     │◄────────────►│ REST   │  kerros + DB)   │
 │ React kanban │              │ API    └────────┬────────┘
 └──────────────┘              └─────────────────┘
                                         SQLite-tiedosto
```

Keskeinen periaate: **yksi jaettu `core`-kerros**, jota sekä MCP-palvelin että REST API kutsuvat.
Näin liiketoimintalogiikka (tilasiirtymät, validointi) on yhdessä paikassa.

### Teknologiavalinnat (ehdotus)

| Osa | Valinta | Perustelu |
|---|---|---|
| Kieli | TypeScript kaikkialla | Yksi kieli, jaetut tyypit frontin ja backendin välillä |
| MCP | `@modelcontextprotocol/sdk`, stdio-transport | Virallinen SDK, toimii suoraan Claude Desktop / Claude Code -clientien kanssa |
| Tietokanta | SQLite (`better-sqlite3`), pelkkä SQL (ei ORMia) | Ei erillistä palvelinta, yksi tiedosto; skeema on pieni, joten ORM ei tuo hyötyä |
| REST API | Hono (tai Express) + Zod-validointi | Kevyt; Zod-skeemat uudelleenkäytetään MCP-työkalujen input-skeemoina |
| Frontend | React + Vite + Tailwind, `dnd-kit` kanbanin vedä-ja-pudota | Yleinen stack, hyvä portfolioon |
| Testit | Vitest | Samalla työkalulla core + API |
| Rakenne | npm workspaces (monorepo) | `packages/core`, `packages/mcp`, `packages/api`, `apps/web` |

## 3. Tietomalli

**Paikka (`position`)**
- `id`, `yritys`, `otsikko`, `url`, `sijainti`, `kuvaus`, `lahde` (manuaalinen / haku / linkki), `deadline`, `luotu`

**Hakemus (`application`)**
- `id`, `position_id`, `tila`, `haettu_pvm`, `muistiinpanot`, `seuraava_toimenpide`, `seuraava_pvm`, `paivitetty`

**Tapahtuma (`event`)** – historia
- `id`, `application_id`, `tyyppi` (tilamuutos / muistiinpano / yhteydenotto), `sisalto`, `aika`

**Tilat (kanban-sarakkeet):**
`kiinnostaa` → `valmistelussa` → `haettu` → `haastattelu` → `tarjous` / `hylatty` / `vedetty_pois`

Tilasiirtymät validoidaan `core`ssa ja jokainen siirto kirjataan `event`-tauluun.

## 4. MCP-työkalut

| Työkalu | Tarkoitus | Keskeiset parametrit |
|---|---|---|
| `etsi_paikat` | Hae tallennetuista paikoista JA/TAI ulkoisista lähteistä | `hakusana`, `sijainti`, `vain_hakemattomat` |
| `tallenna_paikka` | Lisää paikka (esim. agentti poimii sen linkistä) | `yritys`, `otsikko`, `url`, `deadline` |
| `tallenna_hakemus` | Luo hakemus paikalle tai päivitä sen tila | `paikka_id`, `tila`, `muistiinpano` |
| `listaa_hakemukset` | Listaa hakemukset tilan mukaan | `tila?` |
| `muistuta` | Palauta deadlinet ja seurantaa vaativat hakemukset (esim. haettu >7 pv sitten, ei vastausta) | `paivia_eteenpain` |
| `lisaa_muistiinpano` | Kirjaa tapahtuma hakemukselle | `hakemus_id`, `teksti` |

Huomioita:
- Työkalujen kuvaukset kirjoitetaan huolella – agentti valitsee työkalun niiden perusteella.
- `muistuta` on *pull*-pohjainen: agentti kysyy sitä (esim. session alussa). Aktiivinen push-ilmoitus on myöhempi laajennus.
- Lukevat ja kirjoittavat työkalut pidetään erillään (kirjoittavat selkeästi nimetty), jotta agentti ei muuta dataa vahingossa.

### Paikkojen hakulähde (avoin kysymys)
Ulkoisen haun toteutus selvitetään vaiheessa 3. Vaihtoehdot: Työmarkkinatori / Duunitori / LinkedIn-rajapinnat tai
scrapaus (tarkista käyttöehdot ja saatavuus ensin). Varasuunnitelma: `etsi_paikat` hakee vain omasta tietokannasta ja
agentti lisää uudet paikat `tallenna_paikka`lla käyttäjän antamista linkeistä. MVP toimii ilman ulkoista hakua.

## 5. Frontend

- **Kanban-näkymä**: sarake per tila, kortit (yritys, otsikko, deadline-merkki), vedä-ja-pudota tilan vaihtoon.
- **Korttinäkymä** (sivupaneeli): tiedot, muistiinpanot, tapahtumahistoria.
- **Lisää paikka** -lomake.
- **Muistutukset**-palkki ylhäällä: lähestyvät deadlinet ja seurantaa odottavat.
- Suodatus yrityksen / tilan / deadlinen mukaan.
- Päivittyy kun agentti muuttaa dataa (alussa: polling tai manuaalinen päivitys; myöhemmin SSE).

## 6. Vaiheistus

| Vaihe | Sisältö | Valmis kun |
|---|---|---|
| **0. Pohja** | Monorepo, TS-konfiguraatio, SQLite + migraatiot, Vitest, README | `npm test` ajaa tyhjän testin; DB luodaan |
| **1. Core + MCP** | Tietomalli, palvelukerros, tilasiirtymät, MCP-työkalut: `tallenna_paikka`, `tallenna_hakemus`, `listaa_hakemukset`, `muistuta` | Claude Desktop / Code osaa lisätä ja listata hakemuksia |
| **2. REST API + kanban** | Hono-API, React-kanban, vedä-ja-pudota, korttipaneeli | Voin hallita hakemuksia selaimessa; MCP:n tekemät muutokset näkyvät siellä |
| **3. Haku ja muistutukset** | `etsi_paikat` (+ ulkoinen lähde jos mahdollinen), muistutuslogiikka, deadline-merkit UI:ssa | Agentti ehdottaa uusia paikkoja ja muistuttaa |
| **4. Viimeistely** | Virheenkäsittely, testikattavuus, README + demo-gif, ajaminen yhdellä komennolla | Repo valmis näytettäväksi |

Jokaisen vaiheen jälkeen sovellus on käyttökelpoinen – aloitetaan käyttö omassa haussa jo vaiheen 2 jälkeen.

## 7. Testaus

- `core`: yksikkötestit tilasiirtymille ja muistutuslogiikalle (deadline, "ei vastausta N päivään").
- MCP: integraatiotesti, joka kutsuu työkaluja SDK:n clientillä muistissa olevaa SQLite-kantaa vasten.
- API: testit Honon `app.request()`illä.
- Frontend: manuaalinen + muutama komponenttitesti; kanbanin pääpolku selaimessa tarkistetaan käsin.

## 8. Riskit

| Riski | Torjunta |
|---|---|
| Ulkoisen haun rajapinta puuttuu tai ehdot kieltävät scrapingin | MVP ei riipu siitä; manuaalinen/linkkipohjainen lisäys |
| Agentti kirjoittaa väärää dataa | Selkeät työkalukuvaukset, Zod-validointi, tapahtumahistoria jolla muutokset jäljitettävissä |
| Laajuus kasvaa | MVP-rajaus (kohta 1); uudet ideat listaan "Myöhemmin" |

## 9. Myöhemmin (ei nyt)

- Push-muistutukset (sähköposti / työpöytäilmoitus)
- Hakemus- ja saatekirjepohjien hallinta, agentti luonnostelee saatekirjeen paikan kuvauksesta
- Tilastot (montako hakemusta, vastausprosentti)
- Gmail-integraatio vastausten tunnistamiseen
- Julkaisu pilveen

## 10. Haastattelutarina

"Tein sovelluksen omaan harjoittelupaikkahakuuni. Halusin, että agentti hoitaa kirjaamisen ja muistuttamisen
(MCP-työkalut) ja minä näen kokonaiskuvan kanbanissa. Jaoin logiikan `core`-kerrokseen, jota sekä MCP että REST
käyttävät, jotta tilasäännöt ovat yhdessä paikassa."
