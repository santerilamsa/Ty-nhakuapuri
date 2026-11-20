import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Tietokannan sijainti: TYONHAKUAPURI_DB tai oletuksena ~/.tyonhakuapuri/tyonhakuapuri.db.
 * MCP-palvelin ja REST API käyttävät samaa polkua, jotta ne näkevät saman datan.
 * Luo tarvittaessa hakemiston.
 */
export function dbPolku(): string {
  const polku = process.env.TYONHAKUAPURI_DB ?? join(homedir(), ".tyonhakuapuri", "tyonhakuapuri.db");
  mkdirSync(dirname(polku), { recursive: true });
  return polku;
}
