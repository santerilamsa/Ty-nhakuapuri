import type { Db } from "./db.js";
import { SovellusVirhe } from "./errors.js";
import { haePaikka } from "./paikat.js";
import { voiSiirtya } from "./transitions.js";
import { TILAT, type Hakemus, type Tapahtuma, type Tapahtumatyyppi, type Tila } from "./types.js";

const tanaan = () => new Date().toISOString().slice(0, 10);

function kirjaaTapahtuma(db: Db, hakemusId: number, tyyppi: Tapahtumatyyppi, sisalto: string) {
  db.prepare("INSERT INTO tapahtuma (hakemus_id, tyyppi, sisalto) VALUES (?, ?, ?)").run(
    hakemusId,
    tyyppi,
    sisalto,
  );
}

export function haeHakemus(db: Db, id: number): Hakemus {
  const rivi = db.prepare("SELECT * FROM hakemus WHERE id = ?").get(id) as Hakemus | undefined;
  if (!rivi) throw new SovellusVirhe(`Hakemusta ${id} ei löydy.`, "ei_loydy");
  return rivi;
}

/** Luo hakemuksen paikalle. Jos hakemus on jo olemassa, palautetaan se sellaisenaan. */
export function luoHakemus(db: Db, paikkaId: number, tila: Tila = "kiinnostaa"): Hakemus {
  if (!TILAT.includes(tila)) {
    throw new SovellusVirhe(`Tuntematon tila: ${tila}`, "virheellinen_syote");
  }
  haePaikka(db, paikkaId); // heittää jos paikkaa ei ole

  const olemassa = db.prepare("SELECT * FROM hakemus WHERE paikka_id = ?").get(paikkaId) as
    | Hakemus
    | undefined;
  if (olemassa) return olemassa;

  return db.transaction(() => {
    const tulos = db
      .prepare("INSERT INTO hakemus (paikka_id, tila, haettu_pvm) VALUES (?, ?, ?)")
      .run(paikkaId, tila, tila === "haettu" ? tanaan() : null);
    const id = Number(tulos.lastInsertRowid);
    kirjaaTapahtuma(db, id, "tilamuutos", `Hakemus luotu tilaan ${tila}`);
    return haeHakemus(db, id);
  })();
}

/** Siirtää hakemuksen uuteen tilaan sääntöjen mukaan ja kirjaa tapahtuman. */
export function siirraTila(db: Db, id: number, uusi: Tila, muistiinpano?: string): Hakemus {
  if (!TILAT.includes(uusi)) {
    throw new SovellusVirhe(`Tuntematon tila: ${uusi}`, "virheellinen_syote");
  }
  return db.transaction(() => {
    const nykyinen = haeHakemus(db, id);
    if (nykyinen.tila === uusi) return nykyinen;
    if (!voiSiirtya(nykyinen.tila, uusi)) {
      throw new SovellusVirhe(
        `Siirtymä ${nykyinen.tila} → ${uusi} ei ole sallittu.`,
        "virheellinen_siirtyma",
      );
    }
    db.prepare(
      `UPDATE hakemus
         SET tila = @tila,
             haettu_pvm = CASE WHEN @tila = 'haettu' AND haettu_pvm IS NULL THEN @tanaan ELSE haettu_pvm END,
             paivitetty = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = @id`,
    ).run({ tila: uusi, tanaan: tanaan(), id });
    const teksti = `${nykyinen.tila} → ${uusi}` + (muistiinpano ? `: ${muistiinpano}` : "");
    kirjaaTapahtuma(db, id, "tilamuutos", teksti);
    return haeHakemus(db, id);
  })();
}

export function lisaaMuistiinpano(db: Db, id: number, teksti: string): Tapahtuma {
  const sisalto = teksti?.trim();
  if (!sisalto) throw new SovellusVirhe("Muistiinpano ei voi olla tyhjä.", "virheellinen_syote");
  return db.transaction(() => {
    haeHakemus(db, id);
    kirjaaTapahtuma(db, id, "muistiinpano", sisalto);
    db.prepare("UPDATE hakemus SET paivitetty = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(id);
    return db
      .prepare("SELECT * FROM tapahtuma WHERE hakemus_id = ? ORDER BY id DESC LIMIT 1")
      .get(id) as Tapahtuma;
  })();
}

export function asetaSeuraavaToimenpide(
  db: Db,
  id: number,
  toimenpide: string | null,
  pvm: string | null,
): Hakemus {
  if (pvm && !/^\d{4}-\d{2}-\d{2}$/.test(pvm)) {
    throw new SovellusVirhe("Päivämäärä pitää olla muodossa YYYY-MM-DD.", "virheellinen_syote");
  }
  haeHakemus(db, id);
  db.prepare(
    `UPDATE hakemus SET seuraava_toimenpide = ?, seuraava_pvm = ?,
       paivitetty = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(toimenpide, pvm, id);
  return haeHakemus(db, id);
}

export interface HakemusRivi extends Hakemus {
  yritys: string;
  otsikko: string;
  url: string | null;
  deadline: string | null;
}

/** Hakemukset paikan tiedoilla, valinnaisesti yhdessä tilassa. */
export function listaaHakemukset(db: Db, tila?: Tila): HakemusRivi[] {
  const where = tila ? "WHERE h.tila = ?" : "";
  const rivit = db
    .prepare(
      `SELECT h.*, p.yritys, p.otsikko, p.url, p.deadline
         FROM hakemus h JOIN paikka p ON p.id = h.paikka_id
         ${where}
        ORDER BY h.paivitetty DESC, h.id DESC`,
    )
    .all(...(tila ? [tila] : []));
  return rivit as HakemusRivi[];
}

export function haeTapahtumat(db: Db, hakemusId: number): Tapahtuma[] {
  return db
    .prepare("SELECT * FROM tapahtuma WHERE hakemus_id = ? ORDER BY id")
    .all(hakemusId) as Tapahtuma[];
}
