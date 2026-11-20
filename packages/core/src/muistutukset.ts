import type { Db } from "./db.js";
import { SovellusVirhe } from "./errors.js";
import type { Hakemus } from "./types.js";

export interface MuistutusAsetukset {
  /** Kuinka monen päivän päähän katsotaan (deadlinet, seuraavat toimenpiteet). Oletus 7. */
  paiviaEteenpain?: number;
  /** Kuinka monta päivää haettu hakemus saa olla koskematta ennen seurantamuistutusta. Oletus 7. */
  seurantaPaivia?: number;
  /** Päivä YYYY-MM-DD. Oletus tänään. Käytetään testeissä. */
  tanaan?: string;
}

export interface DeadlineMuistutus {
  paikka_id: number;
  hakemus_id: number | null;
  yritys: string;
  otsikko: string;
  deadline: string;
  paivia_jaljella: number;
}

export interface SeurantaMuistutus {
  hakemus_id: number;
  yritys: string;
  otsikko: string;
  haettu_pvm: string | null;
  paivia_hiljaa: number;
}

export interface ToimenpideMuistutus {
  hakemus_id: number;
  yritys: string;
  otsikko: string;
  toimenpide: string | null;
  pvm: string;
  myohassa: boolean;
}

export interface Muistutukset {
  tanaan: string;
  /** Paikat, joiden hakuaika päättyy pian ja joihin ei ole vielä haettu. */
  deadlinet: DeadlineMuistutus[];
  /** Haetut hakemukset, joihin ei ole tullut päivityksiä pitkään aikaan. */
  seuranta: SeurantaMuistutus[];
  /** Itse asetetut seuraavat toimenpiteet, jotka erääntyvät pian tai ovat myöhässä. */
  toimenpiteet: ToimenpideMuistutus[];
}

const MS_PAIVA = 86_400_000;

const paivaNumero = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / MS_PAIVA);

function lisaaPaivia(iso: string, n: number): string {
  return new Date((paivaNumero(iso) + n) * MS_PAIVA).toISOString().slice(0, 10);
}

/** Kokoaa asiat, joihin käyttäjän (tai agentin) kannattaa tarttua. */
export function muistutukset(db: Db, asetukset: MuistutusAsetukset = {}): Muistutukset {
  const tanaan = asetukset.tanaan ?? new Date().toISOString().slice(0, 10);
  const eteen = asetukset.paiviaEteenpain ?? 7;
  const seuranta = asetukset.seurantaPaivia ?? 7;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanaan) || Number.isNaN(Date.parse(tanaan))) {
    throw new SovellusVirhe("Päivä pitää olla muodossa YYYY-MM-DD.", "virheellinen_syote");
  }
  if (!Number.isInteger(eteen) || eteen < 0 || !Number.isInteger(seuranta) || seuranta < 0) {
    throw new SovellusVirhe("Päivämäärät pitää olla kokonaislukuja ≥ 0.", "virheellinen_syote");
  }

  const deadlineRajaus = lisaaPaivia(tanaan, eteen);
  const seurantaRaja = lisaaPaivia(tanaan, -seuranta);

  const deadlineRivit = db
    .prepare(
      `SELECT p.id AS paikka_id, h.id AS hakemus_id, p.yritys, p.otsikko, p.deadline
         FROM paikka p LEFT JOIN hakemus h ON h.paikka_id = p.id
        WHERE p.deadline BETWEEN @tanaan AND @raja
          AND (h.id IS NULL OR h.tila IN ('kiinnostaa', 'valmistelussa'))
        ORDER BY p.deadline, p.id`,
    )
    .all({ tanaan, raja: deadlineRajaus }) as Omit<DeadlineMuistutus, "paivia_jaljella">[];

  const seurantaRivit = db
    .prepare(
      `SELECT h.id AS hakemus_id, p.yritys, p.otsikko, h.haettu_pvm, h.paivitetty
         FROM hakemus h JOIN paikka p ON p.id = h.paikka_id
        WHERE h.tila = 'haettu' AND substr(h.paivitetty, 1, 10) <= @raja
        ORDER BY h.paivitetty, h.id`,
    )
    .all({ raja: seurantaRaja }) as (Omit<SeurantaMuistutus, "paivia_hiljaa"> & Pick<Hakemus, "paivitetty">)[];

  const toimenpideRivit = db
    .prepare(
      `SELECT h.id AS hakemus_id, p.yritys, p.otsikko,
              h.seuraava_toimenpide AS toimenpide, h.seuraava_pvm AS pvm
         FROM hakemus h JOIN paikka p ON p.id = h.paikka_id
        WHERE h.seuraava_pvm IS NOT NULL AND h.seuraava_pvm <= @raja
          AND h.tila NOT IN ('hylatty', 'vedetty_pois')
        ORDER BY h.seuraava_pvm, h.id`,
    )
    .all({ raja: deadlineRajaus }) as Omit<ToimenpideMuistutus, "myohassa">[];

  return {
    tanaan,
    deadlinet: deadlineRivit.map((r) => ({
      ...r,
      paivia_jaljella: paivaNumero(r.deadline) - paivaNumero(tanaan),
    })),
    seuranta: seurantaRivit.map(({ paivitetty, ...r }) => ({
      ...r,
      paivia_hiljaa: paivaNumero(tanaan) - paivaNumero(paivitetty.slice(0, 10)),
    })),
    toimenpiteet: toimenpideRivit.map((r) => ({ ...r, myohassa: r.pvm < tanaan })),
  };
}
