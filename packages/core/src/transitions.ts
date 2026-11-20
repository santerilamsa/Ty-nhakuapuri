import type { Tila } from "./types.js";

/** Sallitut tilasiirtymät. Päätetyt tilat voi avata uudelleen vain tilaan 'kiinnostaa'. */
export const SALLITUT_SIIRTYMAT: Record<Tila, readonly Tila[]> = {
  kiinnostaa: ["valmistelussa", "haettu", "vedetty_pois"],
  valmistelussa: ["kiinnostaa", "haettu", "vedetty_pois"],
  haettu: ["haastattelu", "tarjous", "hylatty", "vedetty_pois"],
  haastattelu: ["tarjous", "hylatty", "vedetty_pois"],
  tarjous: ["hylatty", "vedetty_pois"],
  hylatty: ["kiinnostaa"],
  vedetty_pois: ["kiinnostaa"],
};

export function voiSiirtya(nykyinen: Tila, uusi: Tila): boolean {
  return SALLITUT_SIIRTYMAT[nykyinen].includes(uusi);
}
