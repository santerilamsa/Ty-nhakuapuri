import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { openDb } from "@tyonhakuapuri/core";
import { beforeEach, describe, expect, it } from "vitest";
import { luoPalvelin } from "./server.js";

let client: Client;

beforeEach(async () => {
  const palvelin = luoPalvelin(openDb(":memory:"));
  const [clientPuoli, palvelinPuoli] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "testi", version: "0.0.0" });
  await Promise.all([palvelin.connect(palvelinPuoli), client.connect(clientPuoli)]);
});

async function kutsu(name: string, args: Record<string, unknown>) {
  const tulos = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
  const teksti = tulos.content[0]?.text ?? "";
  return { isError: !!tulos.isError, teksti, data: tulos.isError ? null : JSON.parse(teksti) };
}

describe("MCP-työkalut", () => {
  it("julkaisee kolme työkalua", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "listaa_hakemukset",
      "tallenna_hakemus",
      "tallenna_paikka",
    ]);
  });

  it("tallentaa paikan, luo hakemuksen ja siirtää sen tilaan haettu", async () => {
    const paikka = await kutsu("tallenna_paikka", {
      yritys: "Acme",
      otsikko: "Harjoittelija",
      url: "https://acme.fi/job/1",
      deadline: "2026-12-15",
    });
    expect(paikka.data.lahde).toBe("agentti");

    const luotu = await kutsu("tallenna_hakemus", { paikka_id: paikka.data.id });
    expect(luotu.data.tila).toBe("kiinnostaa");

    const haettu = await kutsu("tallenna_hakemus", {
      paikka_id: paikka.data.id,
      tila: "haettu",
      muistiinpano: "Lähetetty CV",
    });
    expect(haettu.data.tila).toBe("haettu");

    const lista = await kutsu("listaa_hakemukset", { tila: "haettu" });
    expect(lista.data).toHaveLength(1);
    expect(lista.data[0].yritys).toBe("Acme");
  });

  it("palauttaa kielletystä siirtymästä virheen, ei kaadu", async () => {
    const paikka = await kutsu("tallenna_paikka", { yritys: "A", otsikko: "x" });
    await kutsu("tallenna_hakemus", { paikka_id: paikka.data.id, tila: "haettu" });
    const virhe = await kutsu("tallenna_hakemus", { paikka_id: paikka.data.id, tila: "kiinnostaa" });
    expect(virhe.isError).toBe(true);
    expect(virhe.teksti).toMatch(/ei ole sallittu/);
  });

  it("palauttaa virheen tuntemattomalle paikalle", async () => {
    const virhe = await kutsu("tallenna_hakemus", { paikka_id: 999 });
    expect(virhe.isError).toBe(true);
    expect(virhe.teksti).toMatch(/ei löydy/);
  });
});
