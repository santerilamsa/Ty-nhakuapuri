#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDb } from "@tyonhakuapuri/core";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { luoPalvelin } from "./server.js";

// Tietokannan sijainti: TYONHAKUAPURI_DB tai oletuksena ~/.tyonhakuapuri/tyonhakuapuri.db
// (MCP-clientit käynnistävät palvelimen mielivaltaisesta hakemistosta, joten suhteellinen polku ei kelpaa.)
const dbPolku = process.env.TYONHAKUAPURI_DB ?? join(homedir(), ".tyonhakuapuri", "tyonhakuapuri.db");
mkdirSync(dirname(dbPolku), { recursive: true });

const db = openDb(dbPolku);
const palvelin = luoPalvelin(db);

// stdout on varattu MCP-protokollalle, lokit vain stderriin.
await palvelin.connect(new StdioServerTransport());
console.error(`tyonhakuapuri-mcp käynnissä, tietokanta: ${dbPolku}`);
