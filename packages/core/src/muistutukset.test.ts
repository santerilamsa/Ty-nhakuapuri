import { beforeEach, describe, expect, it } from "vitest";
import {
  asetaSeuraavaToimenpide,
  luoHakemus,
  luoPaikka,
  muistutukset,
  openDb,
  siirraTila,
  type Db,
} from "./index.js";

const TANAAN = "2026-11-20";
let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("muistutukset: deadlinet", () => {
  it("listaa lähestyvät deadlinet jäljellä olevine päivineen", () => {
    luoPaikka(db, { yritys: "Pian", otsikko: "x", deadline: "2026-11-23" });
    luoPaikka(db, { yritys: "Kaukana", otsikko: "x", deadline: "2026-12-30" });
    luoPaikka(db, { yritys: "Mennyt", otsikko: "x", deadline: "2026-11-01" });
    luoPaikka(db, { yritys: "Ei deadlinea", otsikko: "x" });
    const { deadlinet } = muistutukset(db, { tanaan: TANAAN });
    expect(deadlinet.map((d) => [d.yritys, d.paivia_jaljella])).toEqual([["Pian", 3]]);
  });

  it("ei muistuta paikoista, joihin on jo haettu", () => {
    const p = luoPaikka(db, { yritys: "Haettu", otsikko: "x", deadline: "2026-11-22" });
    siirraTila(db, luoHakemus(db, p.id).id, "haettu");
    const q = luoPaikka(db, { yritys: "Kesken", otsikko: "x", deadline: "2026-11-22" });
    luoHakemus(db, q.id, "valmistelussa");
    const { deadlinet } = muistutukset(db, { tanaan: TANAAN });
    expect(deadlinet.map((d) => d.yritys)).toEqual(["Kesken"]);
  });

  it("noudattaa paiviaEteenpain-asetusta (raja on mukana)", () => {
    luoPaikka(db, { yritys: "A", otsikko: "x", deadline: "2026-11-30" });
    expect(muistutukset(db, { tanaan: TANAAN, paiviaEteenpain: 9 }).deadlinet).toHaveLength(0);
    expect(muistutukset(db, { tanaan: TANAAN, paiviaEteenpain: 10 }).deadlinet).toHaveLength(1);
  });
});

describe("muistutukset: seuranta", () => {
  function haettuHakemus(paivitetty: string) {
    const p = luoPaikka(db, { yritys: "Acme", otsikko: "x" });
    const h = siirraTila(db, luoHakemus(db, p.id).id, "haettu");
    db.prepare("UPDATE hakemus SET paivitetty = ? WHERE id = ?").run(paivitetty, h.id);
    return h;
  }

  it("muistuttaa haetusta hakemuksesta, jossa ei ole tapahtunut mitään yli viikkoon", () => {
    haettuHakemus("2026-11-10T09:00:00.000Z");
    const { seuranta } = muistutukset(db, { tanaan: TANAAN });
    expect(seuranta).toHaveLength(1);
    expect(seuranta[0]?.paivia_hiljaa).toBe(10);
  });

  it("ei muistuta tuoreesta hakemuksesta eikä muista tiloista", () => {
    haettuHakemus("2026-11-18T09:00:00.000Z");
    const p = luoPaikka(db, { yritys: "B", otsikko: "x" });
    const h = luoHakemus(db, p.id);
    db.prepare("UPDATE hakemus SET paivitetty = '2026-10-01T00:00:00.000Z' WHERE id = ?").run(h.id);
    expect(muistutukset(db, { tanaan: TANAAN }).seuranta).toHaveLength(0);
  });
});

describe("muistutukset: toimenpiteet", () => {
  it("listaa erääntyvät ja myöhässä olevat toimenpiteet", () => {
    const a = luoHakemus(db, luoPaikka(db, { yritys: "A", otsikko: "x" }).id);
    const b = luoHakemus(db, luoPaikka(db, { yritys: "B", otsikko: "x" }).id);
    const c = luoHakemus(db, luoPaikka(db, { yritys: "C", otsikko: "x" }).id);
    asetaSeuraavaToimenpide(db, a.id, "Soita", "2026-11-18");
    asetaSeuraavaToimenpide(db, b.id, "Lähetä portfolio", "2026-11-25");
    asetaSeuraavaToimenpide(db, c.id, "Liian kaukana", "2026-12-31");
    const { toimenpiteet } = muistutukset(db, { tanaan: TANAAN });
    expect(toimenpiteet.map((t) => [t.yritys, t.myohassa])).toEqual([
      ["A", true],
      ["B", false],
    ]);
  });

  it("ohittaa hylätyt hakemukset", () => {
    const a = luoHakemus(db, luoPaikka(db, { yritys: "A", otsikko: "x" }).id);
    asetaSeuraavaToimenpide(db, a.id, "Soita", "2026-11-21");
    siirraTila(db, a.id, "vedetty_pois");
    expect(muistutukset(db, { tanaan: TANAAN }).toimenpiteet).toHaveLength(0);
  });
});

describe("muistutukset: syötteen tarkistus", () => {
  it("hylkää virheellisen päivän", () => {
    expect(() => muistutukset(db, { tanaan: "huomenna" })).toThrowError(/YYYY-MM-DD/);
    expect(() => muistutukset(db, { paiviaEteenpain: -1 })).toThrow();
  });
});
