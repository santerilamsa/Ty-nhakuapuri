#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dbPolku, openDb } from "@tyonhakuapuri/core";
import { luoPalvelin } from "./server.js";

// MCP-clientit käynnistävät palvelimen mielivaltaisesta hakemistosta, joten polku on aina absoluuttinen.
const polku = dbPolku();
const palvelin = luoPalvelin(openDb(polku));

// stdout on varattu MCP-protokollalle, lokit vain stderriin.
await palvelin.connect(new StdioServerTransport());
console.error(`tyonhakuapuri-mcp käynnissä, tietokanta: ${polku}`);
