import { serve } from "@hono/node-server";
import { dbPolku, openDb } from "@tyonhakuapuri/core";
import { luoApp } from "./app.js";

const polku = dbPolku();
const app = luoApp(openDb(polku));
const portti = Number(process.env.PORT ?? 3001);

// Henkilökohtainen työkalu ilman kirjautumista: kuunnellaan vain localhostia.
serve({ fetch: app.fetch, port: portti, hostname: "127.0.0.1" }, () => {
  console.log(`tyonhakuapuri-api: http://127.0.0.1:${portti}, tietokanta: ${polku}`);
});
