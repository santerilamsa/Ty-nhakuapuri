import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  SovellusVirhe,
  TILAT,
  haeHakemus,
  lisaaMuistiinpano,
  listaaHakemukset,
  luoHakemus,
  luoPaikka,
  siirraTila,
  type Db,
} from "@tyonhakuapuri/core";
import { z } from "zod";

const tilaSchema = z.enum(TILAT);

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Muuttaa palvelukerroksen virheet työkalun virhevastaukseksi, jonka agentti näkee. */
function suorita(fn: () => unknown): CallToolResult {
  try {
    return ok(fn());
  } catch (e) {
    if (e instanceof SovellusVirhe) {
      return { isError: true, content: [{ type: "text", text: e.message }] };
    }
    throw e;
  }
}

export function luoPalvelin(db: Db): McpServer {
  const server = new McpServer({ name: "tyonhakuapuri", version: "0.1.0" });

  server.registerTool(
    "tallenna_paikka",
    {
      description:
        "Tallentaa harjoittelu- tai työpaikan seurantaan. Käytä, kun käyttäjä antaa linkin tai tiedot " +
        "paikasta. Jos sama url on jo tallennettu, palautetaan olemassa oleva paikka. " +
        "Tämä EI vielä luo hakemusta – käytä sen jälkeen tallenna_hakemus.",
      inputSchema: {
        yritys: z.string().describe("Yrityksen tai organisaation nimi"),
        otsikko: z.string().describe("Paikan nimike, esim. 'Ohjelmistoharjoittelija'"),
        url: z.string().url().optional().describe("Linkki ilmoitukseen"),
        sijainti: z.string().optional(),
        kuvaus: z.string().optional().describe("Lyhyt kuvaus tai ilmoituksen keskeinen sisältö"),
        deadline: z.string().optional().describe("Hakuaika päättyy, muodossa YYYY-MM-DD"),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) => suorita(() => luoPaikka(db, { ...args, lahde: "agentti" })),
  );

  server.registerTool(
    "tallenna_hakemus",
    {
      description:
        "Luo hakemuksen tallennetulle paikalle tai siirtää olemassa olevan hakemuksen uuteen tilaan " +
        `(${TILAT.join(", ")}). Tilasiirtymiä säännellään: esim. 'haettu' ei voi palata tilaan ` +
        "'kiinnostaa'. Voit liittää mukaan muistiinpanon, joka kirjataan hakemuksen historiaan.",
      inputSchema: {
        paikka_id: z.number().int().describe("Paikan id (tallenna_paikka palauttaa sen)"),
        tila: tilaSchema.optional().describe("Haluttu tila. Oletus 'kiinnostaa' uudelle hakemukselle."),
        muistiinpano: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ paikka_id, tila, muistiinpano }) =>
      suorita(() => {
        const hakemus = luoHakemus(db, paikka_id, tila ?? "kiinnostaa");
        if (tila && hakemus.tila !== tila) {
          return siirraTila(db, hakemus.id, tila, muistiinpano);
        }
        if (muistiinpano) lisaaMuistiinpano(db, hakemus.id, muistiinpano);
        return haeHakemus(db, hakemus.id);
      }),
  );

  server.registerTool(
    "listaa_hakemukset",
    {
      description:
        "Listaa hakemukset paikan tiedoilla, uusimmin päivitetyt ensin. Rajaa halutessasi yhteen tilaan.",
      inputSchema: {
        tila: tilaSchema.optional().describe("Näytä vain tämän tilan hakemukset"),
      },
      annotations: { readOnlyHint: true },
    },
    ({ tila }) => suorita(() => listaaHakemukset(db, tila)),
  );

  return server;
}
