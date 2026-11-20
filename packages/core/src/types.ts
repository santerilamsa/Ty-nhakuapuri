/** Kanban-sarakkeet / hakemuksen tilat. */
export const TILAT = [
  "kiinnostaa",
  "valmistelussa",
  "haettu",
  "haastattelu",
  "tarjous",
  "hylatty",
  "vedetty_pois",
] as const;

export type Tila = (typeof TILAT)[number];

export const TAPAHTUMATYYPIT = ["tilamuutos", "muistiinpano", "yhteydenotto"] as const;

export type Tapahtumatyyppi = (typeof TAPAHTUMATYYPIT)[number];

export interface Paikka {
  id: number;
  yritys: string;
  otsikko: string;
  url: string | null;
  sijainti: string | null;
  kuvaus: string | null;
  lahde: string;
  deadline: string | null; // ISO-päivä YYYY-MM-DD
  luotu: string; // ISO-aikaleima
}

export interface Hakemus {
  id: number;
  paikka_id: number;
  tila: Tila;
  haettu_pvm: string | null;
  muistiinpanot: string | null;
  seuraava_toimenpide: string | null;
  seuraava_pvm: string | null;
  paivitetty: string;
}

export interface Tapahtuma {
  id: number;
  hakemus_id: number;
  tyyppi: Tapahtumatyyppi;
  sisalto: string;
  aika: string;
}
