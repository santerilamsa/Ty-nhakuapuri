import type { Db } from "./db.js";
import { SovellusVirhe } from "./errors.js";
import type { Paikka } from "./types.js";

export interface UusiPaikka {
  yritys: string;
  otsikko: string;
  url?: string;
  sijainti?: string;
  kuvaus?: string;
  lahde?: string;
  deadline?: string; // YYYY-MM-DD
}

const PVM = /^\d{4}-\d{2}-\d{2}$/;

/** Lisää paikan. Jos sama url on jo tallennettu, palautetaan olemassa oleva paikka. */
export function luoPaikka(db: Db, syote: UusiPaikka): Paikka {
  const yritys = syote.yritys?.trim();
  const otsikko = syote.otsikko?.trim();
  if (!yritys || !otsikko) {
    throw new SovellusVirhe("Yritys ja otsikko vaaditaan.", "virheellinen_syote");
  }
  if (syote.deadline && !PVM.test(syote.deadline)) {
    throw new SovellusVirhe("Deadline pitää olla muodossa YYYY-MM-DD.", "virheellinen_syote");
  }

  if (syote.url) {
    const olemassa = db.prepare("SELECT * FROM paikka WHERE url = ?").get(syote.url) as Paikka | undefined;
    if (olemassa) return olemassa;
  }

  const tulos = db
    .prepare(
      `INSERT INTO paikka (yritys, otsikko, url, sijainti, kuvaus, lahde, deadline)
       VALUES (@yritys, @otsikko, @url, @sijainti, @kuvaus, @lahde, @deadline)`,
    )
    .run({
      yritys,
      otsikko,
      url: syote.url ?? null,
      sijainti: syote.sijainti ?? null,
      kuvaus: syote.kuvaus ?? null,
      lahde: syote.lahde ?? "manuaalinen",
      deadline: syote.deadline ?? null,
    });
  return haePaikka(db, Number(tulos.lastInsertRowid));
}

export function haePaikka(db: Db, id: number): Paikka {
  const rivi = db.prepare("SELECT * FROM paikka WHERE id = ?").get(id) as Paikka | undefined;
  if (!rivi) throw new SovellusVirhe(`Paikkaa ${id} ei löydy.`, "ei_loydy");
  return rivi;
}

export interface PaikkaHaku {
  hakusana?: string;
  sijainti?: string;
  vainHakemattomat?: boolean;
}

/** Hakee tallennetuista paikoista. Lähimmät deadlinet ensin. */
export function etsiPaikat(db: Db, haku: PaikkaHaku = {}): Paikka[] {
  const ehdot: string[] = [];
  const parametrit: Record<string, string> = {};

  if (haku.hakusana) {
    ehdot.push("(p.yritys LIKE @hs OR p.otsikko LIKE @hs OR p.kuvaus LIKE @hs)");
    parametrit.hs = `%${haku.hakusana}%`;
  }
  if (haku.sijainti) {
    ehdot.push("p.sijainti LIKE @sij");
    parametrit.sij = `%${haku.sijainti}%`;
  }
  if (haku.vainHakemattomat) {
    ehdot.push("(h.id IS NULL OR h.tila IN ('kiinnostaa', 'valmistelussa'))");
  }

  const where = ehdot.length ? `WHERE ${ehdot.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT p.* FROM paikka p
       LEFT JOIN hakemus h ON h.paikka_id = p.id
       ${where}
       ORDER BY p.deadline IS NULL, p.deadline, p.id`,
    )
    .all(parametrit) as Paikka[];
}
