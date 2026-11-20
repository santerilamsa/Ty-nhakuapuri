import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SALLITUT_SIIRTYMAT, TILAT, api, type HakemusRivi, type Muistutukset, type Tila } from "./api";
import { Kortti } from "./Kortti";
import { LisaaPaikka } from "./LisaaPaikka";
import { MuistutusPalkki } from "./MuistutusPalkki";
import { Paneeli } from "./Paneeli";
import { Sarake } from "./Sarake";

const POLLAUS_MS = 10_000;

export function App() {
  const [hakemukset, setHakemukset] = useState<HakemusRivi[]>([]);
  const [muistutukset, setMuistutukset] = useState<Muistutukset | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [haku, setHaku] = useState("");
  const [valittu, setValittu] = useState<number | null>(null);
  const [vedettava, setVedettava] = useState<HakemusRivi | null>(null);
  const [lisaaAuki, setLisaaAuki] = useState(false);

  const lataa = useCallback(async () => {
    try {
      const [h, m] = await Promise.all([api.hakemukset(), api.muistutukset()]);
      setHakemukset(h);
      setMuistutukset(m);
      setVirhe(null);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // MCP-agentti muokkaa samaa tietokantaa, joten haetaan säännöllisesti uudelleen.
  useEffect(() => {
    void lataa();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void lataa();
    }, POLLAUS_MS);
    return () => clearInterval(t);
  }, [lataa]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const suodatetut = useMemo(() => {
    const s = haku.trim().toLowerCase();
    return s ? hakemukset.filter((h) => `${h.yritys} ${h.otsikko}`.toLowerCase().includes(s)) : hakemukset;
  }, [hakemukset, haku]);

  function alkoi(e: DragStartEvent) {
    setVedettava(hakemukset.find((h) => h.id === e.active.id) ?? null);
  }

  async function loppui(e: DragEndEvent) {
    setVedettava(null);
    const kohde = e.over?.id as Tila | undefined;
    const h = hakemukset.find((x) => x.id === e.active.id);
    if (!kohde || !h || kohde === h.tila) return;
    if (!SALLITUT_SIIRTYMAT[h.tila].includes(kohde)) {
      setVirhe(`Siirtymä ${h.tila} → ${kohde} ei ole sallittu.`);
      return;
    }
    const edellinen = hakemukset;
    setHakemukset((rivit) => rivit.map((x) => (x.id === h.id ? { ...x, tila: kohde } : x))); // optimistinen
    try {
      await api.siirra(h.id, kohde);
      setVirhe(null);
    } catch (err) {
      setHakemukset(edellinen);
      setVirhe(err instanceof Error ? err.message : String(err));
    }
    void lataa();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Työnhakuapuri</h1>
        <input
          value={haku}
          onChange={(e) => setHaku(e.target.value)}
          placeholder="Suodata yrityksen tai otsikon mukaan…"
          className="ml-4 w-72 rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <div className="ml-auto flex gap-2">
          <button onClick={() => void lataa()} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Päivitä
          </button>
          <button onClick={() => setLisaaAuki(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
            + Lisää paikka
          </button>
        </div>
      </header>

      {virhe && (
        <div role="alert" className="flex items-center justify-between bg-red-100 px-4 py-2 text-sm text-red-800">
          <span>{virhe}</span>
          <button onClick={() => setVirhe(null)} aria-label="Sulje" className="px-2">
            ×
          </button>
        </div>
      )}

      {muistutukset && <MuistutusPalkki muistutukset={muistutukset} onValitse={setValittu} />}

      <DndContext sensors={sensors} onDragStart={alkoi} onDragEnd={loppui} onDragCancel={() => setVedettava(null)}>
        <main className="flex flex-1 gap-3 overflow-x-auto p-4">
          {TILAT.map((tila) => (
            <Sarake
              key={tila}
              tila={tila}
              hakemukset={suodatetut.filter((h) => h.tila === tila)}
              sallittu={!vedettava || vedettava.tila === tila || SALLITUT_SIIRTYMAT[vedettava.tila].includes(tila)}
              onValitse={setValittu}
            />
          ))}
        </main>
        <DragOverlay>{vedettava && <Kortti hakemus={vedettava} ylapuolella />}</DragOverlay>
      </DndContext>

      {valittu !== null && <Paneeli id={valittu} onSulje={() => setValittu(null)} onMuuttui={lataa} />}
      {lisaaAuki && (
        <LisaaPaikka
          onSulje={() => setLisaaAuki(false)}
          onLisatty={() => {
            setLisaaAuki(false);
            void lataa();
          }}
        />
      )}
    </div>
  );
}
