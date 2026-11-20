const MS_PAIVA = 86_400_000;

/** YYYY-MM-DD → "20.11." (tai vuosineen, jos ei kuluva vuosi). */
export function pvmFi(iso: string): string {
  const [v, k, p] = iso.split("-").map(Number);
  const nyt = new Date().getFullYear();
  return v === nyt ? `${p}.${k}.` : `${p}.${k}.${v}`;
}

export function aikaFi(iso: string): string {
  // SQLite-aikaleima "YYYY-MM-DD HH:MM:SS" (UTC) tai ISO
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" });
}

/** Päiviä tähän päivään (paikallinen aika); negatiivinen = mennyt. */
export function paivaaJaljella(iso: string): number {
  const [v, k, p] = iso.split("-").map(Number);
  const nyt = new Date();
  const tanaan = Date.UTC(nyt.getFullYear(), nyt.getMonth(), nyt.getDate());
  return Math.round((Date.UTC(v, k - 1, p) - tanaan) / MS_PAIVA);
}
