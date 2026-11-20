import { beforeEach, describe, expect, it } from "vitest";
import {
  SovellusVirhe,
  asetaSeuraavaToimenpide,
  etsiPaikat,
  haeTapahtumat,
  lisaaMuistiinpano,
  listaaHakemukset,
  luoHakemus,
  luoPaikka,
  openDb,
  siirraTila,
  voiSiirtya,
  type Db,
} from "./index.js";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("tilasiirtymät", () => {
  it("sallii etenemisen ja estää hypyt taaksepäin", () => {
    expect(voiSiirtya("haettu", "haastattelu")).toBe(true);
    expect(voiSiirtya("haettu", "kiinnostaa")).toBe(false);
    expect(voiSiirtya("hylatty", "haettu")).toBe(false);
    expect(voiSiirtya("hylatty", "kiinnostaa")).toBe(true);
  });
});

describe("paikat", () => {
  it("luo paikan ja palauttaa saman url:n kaksoiskappaleen sijaan", () => {
    const a = luoPaikka(db, { yritys: "Acme", otsikko: "Harjoittelija", url: "https://x.fi/1" });
    const b = luoPaikka(db, { yritys: "Acme", otsikko: "Harjoittelija", url: "https://x.fi/1" });
    expect(b.id).toBe(a.id);
  });

  it("vaatii yrityksen, otsikon ja kelvollisen deadlinen", () => {
    expect(() => luoPaikka(db, { yritys: " ", otsikko: "x" })).toThrow(SovellusVirhe);
    expect(() => luoPaikka(db, { yritys: "A", otsikko: "x", deadline: "1.2.2026" })).toThrow(
      SovellusVirhe,
    );
  });

  it("hakee hakusanalla ja järjestää deadlinen mukaan", () => {
    luoPaikka(db, { yritys: "Beta", otsikko: "Dev-harjoittelu", deadline: "2026-12-01" });
    luoPaikka(db, { yritys: "Alfa", otsikko: "Dev-harjoittelu", deadline: "2026-11-25" });
    luoPaikka(db, { yritys: "Gamma", otsikko: "Myynti" });
    const tulos = etsiPaikat(db, { hakusana: "Dev" });
    expect(tulos.map((p) => p.yritys)).toEqual(["Alfa", "Beta"]);
  });

  it("vainHakemattomat piilottaa haetut paikat", () => {
    const a = luoPaikka(db, { yritys: "A", otsikko: "x" });
    luoPaikka(db, { yritys: "B", otsikko: "y" });
    const h = luoHakemus(db, a.id);
    siirraTila(db, h.id, "haettu");
    expect(etsiPaikat(db, { vainHakemattomat: true }).map((p) => p.yritys)).toEqual(["B"]);
  });
});

describe("hakemukset", () => {
  it("luo hakemuksen kerran per paikka ja kirjaa tapahtuman", () => {
    const p = luoPaikka(db, { yritys: "Acme", otsikko: "Harjoittelija" });
    const h1 = luoHakemus(db, p.id);
    const h2 = luoHakemus(db, p.id);
    expect(h2.id).toBe(h1.id);
    expect(h1.tila).toBe("kiinnostaa");
    expect(haeTapahtumat(db, h1.id)).toHaveLength(1);
  });

  it("siirtää tilaa, asettaa haettu_pvm ja kirjaa historian", () => {
    const p = luoPaikka(db, { yritys: "Acme", otsikko: "Harjoittelija" });
    const h = luoHakemus(db, p.id);
    const haettu = siirraTila(db, h.id, "haettu", "Lähetetty sähköpostilla");
    expect(haettu.tila).toBe("haettu");
    expect(haettu.haettu_pvm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const historia = haeTapahtumat(db, h.id);
    expect(historia.at(-1)?.sisalto).toContain("kiinnostaa → haettu");
    expect(historia.at(-1)?.sisalto).toContain("Lähetetty sähköpostilla");
  });

  it("estää kielletyn siirtymän eikä kirjaa mitään", () => {
    const p = luoPaikka(db, { yritys: "Acme", otsikko: "Harjoittelija" });
    const h = luoHakemus(db, p.id);
    expect(() => siirraTila(db, h.id, "tarjous")).toThrowError(/ei ole sallittu/);
    expect(haeTapahtumat(db, h.id)).toHaveLength(1);
  });

  it("heittää ei_loydy tuntemattomalle hakemukselle", () => {
    expect(() => siirraTila(db, 999, "haettu")).toThrowError(/ei löydy/);
  });

  it("lisää muistiinpanon ja asettaa seuraavan toimenpiteen", () => {
    const p = luoPaikka(db, { yritys: "Acme", otsikko: "Harjoittelija" });
    const h = luoHakemus(db, p.id);
    const t = lisaaMuistiinpano(db, h.id, "Soitto rekrytoijalle");
    expect(t.tyyppi).toBe("muistiinpano");
    const paivitetty = asetaSeuraavaToimenpide(db, h.id, "Seuraa", "2026-12-01");
    expect(paivitetty.seuraava_pvm).toBe("2026-12-01");
    expect(() => lisaaMuistiinpano(db, h.id, "  ")).toThrow(SovellusVirhe);
  });

  it("listaa hakemukset tilan mukaan paikan tiedoilla", () => {
    const a = luoPaikka(db, { yritys: "A", otsikko: "x" });
    const b = luoPaikka(db, { yritys: "B", otsikko: "y" });
    luoHakemus(db, a.id);
    siirraTila(db, luoHakemus(db, b.id).id, "haettu");
    expect(listaaHakemukset(db)).toHaveLength(2);
    const haetut = listaaHakemukset(db, "haettu");
    expect(haetut).toHaveLength(1);
    expect(haetut[0]?.yritys).toBe("B");
  });
});
