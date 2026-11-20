/** Virhe, jonka viesti voidaan näyttää sellaisenaan käyttäjälle tai agentille. */
export class SovellusVirhe extends Error {
  constructor(
    message: string,
    public readonly koodi: "ei_loydy" | "virheellinen_siirtyma" | "virheellinen_syote",
  ) {
    super(message);
    this.name = "SovellusVirhe";
  }
}
