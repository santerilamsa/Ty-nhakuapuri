import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";

describe("skeema", () => {
  it("luo taulut", () => {
    const db = openDb(":memory:");
    const taulut = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(taulut).toEqual(expect.arrayContaining(["paikka", "hakemus", "tapahtuma"]));
  });

  it("käyttää oletustilana 'kiinnostaa'", () => {
    const db = openDb(":memory:");
    const p = db.prepare("INSERT INTO paikka (yritys, otsikko) VALUES ('Acme', 'Harjoittelija')").run();
    db.prepare("INSERT INTO hakemus (paikka_id) VALUES (?)").run(p.lastInsertRowid);
    const rivi = db.prepare("SELECT tila FROM hakemus").get() as { tila: string };
    expect(rivi.tila).toBe("kiinnostaa");
  });

  it("hylkää tuntemattoman tilan", () => {
    const db = openDb(":memory:");
    const p = db.prepare("INSERT INTO paikka (yritys, otsikko) VALUES ('Acme', 'Harjoittelija')").run();
    expect(() =>
      db.prepare("INSERT INTO hakemus (paikka_id, tila) VALUES (?, 'hupsis')").run(p.lastInsertRowid),
    ).toThrow();
  });

  it("poistaa hakemuksen kun paikka poistetaan", () => {
    const db = openDb(":memory:");
    const p = db.prepare("INSERT INTO paikka (yritys, otsikko) VALUES ('Acme', 'Harjoittelija')").run();
    db.prepare("INSERT INTO hakemus (paikka_id) VALUES (?)").run(p.lastInsertRowid);
    db.prepare("DELETE FROM paikka WHERE id = ?").run(p.lastInsertRowid);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM hakemus").get() as { n: number };
    expect(n).toBe(0);
  });
});
