import { TAPAHTUMATYYPIT, TILAT } from "./types.js";

const sqlList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/** Tietokannan skeema. Tilat ja tapahtumatyypit johdetaan types.ts:stä. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS paikka (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  yritys   TEXT NOT NULL,
  otsikko  TEXT NOT NULL,
  url      TEXT UNIQUE,
  sijainti TEXT,
  kuvaus   TEXT,
  lahde    TEXT NOT NULL DEFAULT 'manuaalinen',
  deadline TEXT,
  luotu    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS hakemus (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  paikka_id           INTEGER NOT NULL UNIQUE REFERENCES paikka(id) ON DELETE CASCADE,
  tila                TEXT NOT NULL DEFAULT 'kiinnostaa' CHECK (tila IN (${sqlList(TILAT)})),
  haettu_pvm          TEXT,
  muistiinpanot       TEXT,
  seuraava_toimenpide TEXT,
  seuraava_pvm        TEXT,
  paivitetty          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tapahtuma (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  hakemus_id  INTEGER NOT NULL REFERENCES hakemus(id) ON DELETE CASCADE,
  tyyppi      TEXT NOT NULL CHECK (tyyppi IN (${sqlList(TAPAHTUMATYYPIT)})),
  sisalto     TEXT NOT NULL,
  aika        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hakemus_tila ON hakemus(tila);
CREATE INDEX IF NOT EXISTS idx_paikka_deadline ON paikka(deadline);
CREATE INDEX IF NOT EXISTS idx_tapahtuma_hakemus ON tapahtuma(hakemus_id);
`;
