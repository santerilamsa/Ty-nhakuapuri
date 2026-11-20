import { openDb } from "@tyonhakuapuri/core";
import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { luoApp } from "./app.js";

let app: Hono;

beforeEach(() => {
  app = luoApp(openDb(":memory:"));
});

async function pyyda(metodi: string, polku: string, runko?: unknown) {
  const res = await app.request(polku, {
    method: metodi,
    headers: { "content-type": "application/json" },
    body: runko === undefined ? undefined : JSON.stringify(runko),
  });
  const teksti = await res.text(); // 204-vastauksella ei ole runkoa
  return { status: res.status, data: teksti ? JSON.parse(teksti) : null };
}

async function luoPaikkaJaHakemus(tila?: string) {
  const paikka = await pyyda("POST", "/api/paikat", {
    yritys: "Acme",
    otsikko: "Harjoittelija",
    deadline: "2026-12-15",
  });
  const hakemus = await pyyda("POST", "/api/hakemukset", { paikka_id: paikka.data.id, tila });
  return { paikka: paikka.data, hakemus: hakemus.data };
}

describe("REST API", () => {
  it("luo paikan ja listaa sen", async () => {
    const luotu = await pyyda("POST", "/api/paikat", {
      yritys: "Acme",
      otsikko: "x",
      url: "https://acme.fi/1",
    });
    expect(luotu.status).toBe(201);
    expect(luotu.data.lahde).toBe("manuaalinen");
    const lista = await pyyda("GET", "/api/paikat?hakusana=acme");
    expect(lista.data).toHaveLength(1);
  });

  it("luo hakemuksen ja palauttaa sen paikan ja historian kanssa", async () => {
    const { hakemus } = await luoPaikkaJaHakemus();
    expect(hakemus.tila).toBe("kiinnostaa");
    const haku = await pyyda("GET", `/api/hakemukset/${hakemus.id}`);
    expect(haku.data.paikka.yritys).toBe("Acme");
    expect(haku.data.tapahtumat).toHaveLength(1);
  });

  it("PATCH siirtää tilan", async () => {
    const { hakemus } = await luoPaikkaJaHakemus();
    const res = await pyyda("PATCH", `/api/hakemukset/${hakemus.id}`, {
      tila: "haettu",
      muistiinpano: "CV lähetetty",
    });
    expect(res.status).toBe(200);
    expect(res.data.tila).toBe("haettu");
    const lista = await pyyda("GET", "/api/hakemukset?tila=haettu");
    expect(lista.data).toHaveLength(1);
  });

  it("DELETE poistaa hakemuksen ja paikan; tuntematon → 404", async () => {
    const { hakemus, paikka } = await luoPaikkaJaHakemus();
    expect((await pyyda("DELETE", `/api/hakemukset/${hakemus.id}`)).status).toBe(204);
    expect((await pyyda("GET", `/api/hakemukset/${hakemus.id}`)).status).toBe(404);
    expect((await pyyda("GET", `/api/paikat/${paikka.id}`)).status).toBe(404);
    expect((await pyyda("DELETE", `/api/hakemukset/${hakemus.id}`)).status).toBe(404);
  });

  it("kielletty siirtymä palauttaa 409", async () => {
    const { hakemus } = await luoPaikkaJaHakemus("haettu");
    const res = await pyyda("PATCH", `/api/hakemukset/${hakemus.id}`, { tila: "kiinnostaa" });
    expect(res.status).toBe(409);
    expect(res.data.koodi).toBe("virheellinen_siirtyma");
  });

  it("asettaa seuraavan toimenpiteen ja säilyttää sen kun vain tila muuttuu", async () => {
    const { hakemus } = await luoPaikkaJaHakemus();
    await pyyda("PATCH", `/api/hakemukset/${hakemus.id}`, {
      seuraava_toimenpide: "Soita",
      seuraava_pvm: "2026-11-25",
    });
    const res = await pyyda("PATCH", `/api/hakemukset/${hakemus.id}`, { tila: "valmistelussa" });
    expect(res.data.seuraava_toimenpide).toBe("Soita");
    const tyhjennys = await pyyda("PATCH", `/api/hakemukset/${hakemus.id}`, {
      seuraava_toimenpide: null,
      seuraava_pvm: null,
    });
    expect(tyhjennys.data.seuraava_pvm).toBeNull();
  });

  it("lisää muistiinpanon", async () => {
    const { hakemus } = await luoPaikkaJaHakemus();
    const res = await pyyda("POST", `/api/hakemukset/${hakemus.id}/muistiinpanot`, { teksti: "Puhelu" });
    expect(res.status).toBe(201);
    expect(res.data.tyyppi).toBe("muistiinpano");
  });

  it("palauttaa 404 tuntemattomalle hakemukselle, paikalle ja reitille", async () => {
    expect((await pyyda("GET", "/api/hakemukset/999")).status).toBe(404);
    expect((await pyyda("PATCH", "/api/hakemukset/999", { tila: "haettu" })).status).toBe(404);
    expect((await pyyda("POST", "/api/hakemukset", { paikka_id: 999 })).status).toBe(404);
    expect((await pyyda("GET", "/api/olematon")).status).toBe(404);
  });

  it("validoi syötteen: 400", async () => {
    expect((await pyyda("POST", "/api/paikat", { yritys: "A" })).status).toBe(400);
    expect(
      (await pyyda("POST", "/api/paikat", { yritys: "A", otsikko: "x", deadline: "huomenna" })).status,
    ).toBe(400);
    expect((await pyyda("GET", "/api/hakemukset?tila=outo")).status).toBe(400);
    expect((await pyyda("GET", "/api/hakemukset/abc")).status).toBe(400);
    const { hakemus } = await luoPaikkaJaHakemus();
    expect((await pyyda("PATCH", `/api/hakemukset/${hakemus.id}`, { tila: "outo" })).status).toBe(400);
    const rikki = await app.request("/api/paikat", { method: "POST", body: "{ei json" });
    expect(rikki.status).toBe(400);
  });

  it("palauttaa muistutukset", async () => {
    const huomenna = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await pyyda("POST", "/api/paikat", { yritys: "Pian", otsikko: "x", deadline: huomenna });
    const res = await pyyda("GET", "/api/muistutukset");
    expect(res.data.deadlinet).toHaveLength(1);
    expect((await pyyda("GET", "/api/muistutukset?paivia_eteenpain=-1")).status).toBe(400);
  });
});
