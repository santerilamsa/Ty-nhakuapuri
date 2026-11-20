import {
  SovellusVirhe,
  TILAT,
  asetaSeuraavaToimenpide,
  etsiPaikat,
  haeHakemus,
  haePaikka,
  haeTapahtumat,
  lisaaMuistiinpano,
  listaaHakemukset,
  luoHakemus,
  luoPaikka,
  muistutukset,
  siirraTila,
  type Db,
} from "@tyonhakuapuri/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

const tila = z.enum(TILAT);
const pvm = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Päivämäärä pitää olla muodossa YYYY-MM-DD");
const id = z.coerce.number().int().positive();

const uusiPaikka = z.object({
  yritys: z.string(),
  otsikko: z.string(),
  url: z.string().url().optional(),
  sijainti: z.string().optional(),
  kuvaus: z.string().optional(),
  deadline: pvm.optional(),
});

const uusiHakemus = z.object({ paikka_id: z.number().int(), tila: tila.optional() });

const hakemusPaivitys = z.object({
  tila: tila.optional(),
  muistiinpano: z.string().optional(),
  seuraava_toimenpide: z.string().nullable().optional(),
  seuraava_pvm: pvm.nullable().optional(),
});

const muistiinpano = z.object({ teksti: z.string() });

const VIRHE_STATUS: Record<SovellusVirhe["koodi"], ContentfulStatusCode> = {
  ei_loydy: 404,
  virheellinen_siirtyma: 409,
  virheellinen_syote: 400,
};

function jasenna<T extends z.ZodType>(skeema: T, data: unknown): z.output<T> {
  const tulos = skeema.safeParse(data);
  if (!tulos.success) throw new SovellusVirhe(z.prettifyError(tulos.error), "virheellinen_syote");
  return tulos.data;
}

/** Jäsentää JSON-rungon ja validoi sen; virheellinen runko → 400. */
async function runko<T extends z.ZodType>(
  c: { req: { json(): Promise<unknown> } },
  skeema: T,
): Promise<z.output<T>> {
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new SovellusVirhe("Pyynnön runko ei ole kelvollista JSONia.", "virheellinen_syote");
  }
  return jasenna(skeema, data);
}

export function luoApp(db: Db): Hono {
  const app = new Hono();

  // Vite-kehityspalvelin ajaa eri portissa; sallitaan vain localhost-originit.
  app.use(
    "/api/*",
    cors({ origin: (o) => (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : null) }),
  );

  app.onError((e, c) => {
    if (e instanceof SovellusVirhe) {
      return c.json({ virhe: e.message, koodi: e.koodi }, VIRHE_STATUS[e.koodi]);
    }
    console.error(e);
    return c.json({ virhe: "Palvelinvirhe", koodi: "palvelinvirhe" }, 500);
  });

  app.notFound((c) => c.json({ virhe: "Reittiä ei löydy.", koodi: "ei_loydy" }, 404));

  app.get("/api/health", (c) => c.json({ ok: true }));

  // --- Paikat ---
  app.get("/api/paikat", (c) => {
    const { hakusana, sijainti, vain_hakemattomat } = c.req.query();
    return c.json(etsiPaikat(db, { hakusana, sijainti, vainHakemattomat: vain_hakemattomat === "true" }));
  });

  app.post("/api/paikat", async (c) => {
    const syote = await runko(c, uusiPaikka);
    return c.json(luoPaikka(db, { ...syote, lahde: "manuaalinen" }), 201);
  });

  app.get("/api/paikat/:id", (c) => c.json(haePaikka(db, jasenna(id, c.req.param("id")))));

  // --- Hakemukset ---
  app.get("/api/hakemukset", (c) => {
    const t = c.req.query("tila");
    return c.json(listaaHakemukset(db, t ? jasenna(tila, t) : undefined));
  });

  app.post("/api/hakemukset", async (c) => {
    const { paikka_id, tila: t } = await runko(c, uusiHakemus);
    return c.json(luoHakemus(db, paikka_id, t ?? "kiinnostaa"), 201);
  });

  app.get("/api/hakemukset/:id", (c) => {
    const hakemus = haeHakemus(db, jasenna(id, c.req.param("id")));
    return c.json({
      ...hakemus,
      paikka: haePaikka(db, hakemus.paikka_id),
      tapahtumat: haeTapahtumat(db, hakemus.id),
    });
  });

  // Kanbanin vedä-ja-pudota käyttää tätä: { tila }. Kielletty siirtymä → 409.
  app.patch("/api/hakemukset/:id", async (c) => {
    const hakemusId = jasenna(id, c.req.param("id"));
    const p = await runko(c, hakemusPaivitys);
    const nykyinen = haeHakemus(db, hakemusId); // 404 ennen muutoksia
    if (p.tila) siirraTila(db, hakemusId, p.tila, p.muistiinpano);
    else if (p.muistiinpano) lisaaMuistiinpano(db, hakemusId, p.muistiinpano);
    if (p.seuraava_toimenpide !== undefined || p.seuraava_pvm !== undefined) {
      asetaSeuraavaToimenpide(
        db,
        hakemusId,
        p.seuraava_toimenpide === undefined ? nykyinen.seuraava_toimenpide : p.seuraava_toimenpide,
        p.seuraava_pvm === undefined ? nykyinen.seuraava_pvm : p.seuraava_pvm,
      );
    }
    return c.json(haeHakemus(db, hakemusId));
  });

  app.post("/api/hakemukset/:id/muistiinpanot", async (c) => {
    const hakemusId = jasenna(id, c.req.param("id"));
    const { teksti } = await runko(c, muistiinpano);
    return c.json(lisaaMuistiinpano(db, hakemusId, teksti), 201);
  });

  // --- Muistutukset ---
  app.get("/api/muistutukset", (c) => {
    const { paivia_eteenpain, seuranta_paivia } = c.req.query();
    const luku = z.coerce.number().int().min(0).optional();
    return c.json(
      muistutukset(db, {
        paiviaEteenpain: jasenna(luku, paivia_eteenpain),
        seurantaPaivia: jasenna(luku, seuranta_paivia),
      }),
    );
  });

  return app;
}
