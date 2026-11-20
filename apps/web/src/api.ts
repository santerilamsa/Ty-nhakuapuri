// Tyypit peilaavat packages/core:n tyyppejä (core on Node-only, joten sitä ei tuoda selaimeen).

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

export const TILA_NIMI: Record<Tila, string> = {
  kiinnostaa: "Kiinnostaa",
  valmistelussa: "Valmistelussa",
  haettu: "Haettu",
  haastattelu: "Haastattelu",
  tarjous: "Tarjous",
  hylatty: "Hylätty",
  vedetty_pois: "Vedetty pois",
};

/** Sama kuin core/transitions.ts — käytetään pudotuskohteiden korostukseen. */
export const SALLITUT_SIIRTYMAT: Record<Tila, readonly Tila[]> = {
  kiinnostaa: ["valmistelussa", "haettu", "vedetty_pois"],
  valmistelussa: ["kiinnostaa", "haettu", "vedetty_pois"],
  haettu: ["haastattelu", "tarjous", "hylatty", "vedetty_pois"],
  haastattelu: ["tarjous", "hylatty", "vedetty_pois"],
  tarjous: ["hylatty", "vedetty_pois"],
  hylatty: ["kiinnostaa"],
  vedetty_pois: ["kiinnostaa"],
};

export interface HakemusRivi {
  id: number;
  paikka_id: number;
  tila: Tila;
  haettu_pvm: string | null;
  muistiinpanot: string | null;
  seuraava_toimenpide: string | null;
  seuraava_pvm: string | null;
  paivitetty: string;
  yritys: string;
  otsikko: string;
  url: string | null;
  deadline: string | null;
}

export interface Paikka {
  id: number;
  yritys: string;
  otsikko: string;
  url: string | null;
  sijainti: string | null;
  kuvaus: string | null;
  lahde: string;
  deadline: string | null;
  luotu: string;
}

export interface Tapahtuma {
  id: number;
  hakemus_id: number;
  tyyppi: "tilamuutos" | "muistiinpano" | "yhteydenotto";
  sisalto: string;
  aika: string;
}

export interface HakemusTiedot extends Omit<HakemusRivi, "yritys" | "otsikko" | "url" | "deadline"> {
  paikka: Paikka;
  tapahtumat: Tapahtuma[];
}

export interface Muistutukset {
  tanaan: string;
  deadlinet: { paikka_id: number; hakemus_id: number | null; yritys: string; otsikko: string; deadline: string; paivia_jaljella: number }[];
  seuranta: { hakemus_id: number; yritys: string; otsikko: string; haettu_pvm: string | null; paivia_hiljaa: number }[];
  toimenpiteet: { hakemus_id: number; yritys: string; otsikko: string; toimenpide: string | null; pvm: string; myohassa: boolean }[];
}

export interface UusiPaikka {
  yritys: string;
  otsikko: string;
  url?: string;
  sijainti?: string;
  kuvaus?: string;
  deadline?: string;
}

async function pyyda<T>(polku: string, init?: RequestInit): Promise<T> {
  const vastaus = await fetch(polku, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (vastaus.status === 204) return undefined as T;
  const data = await vastaus.json().catch(() => null);
  if (!vastaus.ok) throw new Error(data?.virhe ?? `Pyyntö epäonnistui (${vastaus.status})`);
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  hakemukset: () => pyyda<HakemusRivi[]>("/api/hakemukset"),
  hakemus: (id: number) => pyyda<HakemusTiedot>(`/api/hakemukset/${id}`),
  siirra: (id: number, tila: Tila) => pyyda<unknown>(`/api/hakemukset/${id}`, json("PATCH", { tila })),
  paivita: (id: number, muutos: { seuraava_toimenpide?: string | null; seuraava_pvm?: string | null }) =>
    pyyda<unknown>(`/api/hakemukset/${id}`, json("PATCH", muutos)),
  lisaaMuistiinpano: (id: number, teksti: string) =>
    pyyda<unknown>(`/api/hakemukset/${id}/muistiinpanot`, json("POST", { teksti })),
  poista: (id: number) => pyyda<void>(`/api/hakemukset/${id}`, { method: "DELETE" }),
  muistutukset: () => pyyda<Muistutukset>("/api/muistutukset"),
  /** Luo paikan ja sille hakemuksen tilaan kiinnostaa. */
  async lisaaPaikka(syote: UusiPaikka): Promise<void> {
    const paikka = await pyyda<Paikka>("/api/paikat", json("POST", syote));
    await pyyda<unknown>("/api/hakemukset", json("POST", { paikka_id: paikka.id }));
  },
};
