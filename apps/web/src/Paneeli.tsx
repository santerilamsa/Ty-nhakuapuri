import { useCallback, useEffect, useState, type FormEvent } from "react";
import { TILA_NIMI, api, type HakemusTiedot } from "./api";
import { aikaFi } from "./pvm";

interface Props {
  id: number;
  onSulje: () => void;
  onMuuttui: () => void;
  onPoista: () => void;
}

export function Paneeli({ id, onSulje, onMuuttui, onPoista }: Props) {
  const [h, setH] = useState<HakemusTiedot | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [muistiinpano, setMuistiinpano] = useState("");
  const [toimenpide, setToimenpide] = useState("");
  const [toimenpidePvm, setToimenpidePvm] = useState("");

  const lataa = useCallback(async () => {
    try {
      const tiedot = await api.hakemus(id);
      setH(tiedot);
      setToimenpide(tiedot.seuraava_toimenpide ?? "");
      setToimenpidePvm(tiedot.seuraava_pvm ?? "");
      setVirhe(null);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    setH(null);
    void lataa();
  }, [lataa]);

  async function suorita(toiminto: () => Promise<unknown>): Promise<boolean> {
    try {
      await toiminto();
      await lataa();
      onMuuttui();
      return true;
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function lisaaMuistiinpano(e: FormEvent) {
    e.preventDefault();
    if (!muistiinpano.trim()) return;
    if (await suorita(() => api.lisaaMuistiinpano(id, muistiinpano.trim()))) setMuistiinpano("");
  }

  function tallennaToimenpide(e: FormEvent) {
    e.preventDefault();
    void suorita(() =>
      api.paivita(id, { seuraava_toimenpide: toimenpide.trim() || null, seuraava_pvm: toimenpidePvm || null }),
    );
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-10 flex w-96 flex-col overflow-y-auto border-l border-slate-300 bg-white p-4 shadow-xl">
      <button onClick={onSulje} aria-label="Sulje" className="absolute right-3 top-2 text-2xl text-slate-400 hover:text-slate-700">
        ×
      </button>
      {virhe && (
        <p role="alert" className="mb-2 rounded bg-red-100 p-2 text-sm text-red-800">
          {virhe}
        </p>
      )}
      {!h ? (
        !virhe && <p className="text-slate-500">Ladataan…</p>
      ) : (
        <>
          <h2 className="pr-6 text-lg font-semibold">{h.paikka.yritys}</h2>
          <p className="text-slate-700">{h.paikka.otsikko}</p>
          <p className="mt-1 text-xs text-slate-500">
            {TILA_NIMI[h.tila]}
            {h.paikka.sijainti && ` · ${h.paikka.sijainti}`}
            {h.paikka.deadline && ` · DL ${h.paikka.deadline}`}
          </p>
          {h.paikka.url && (
            <a href={h.paikka.url} target="_blank" rel="noreferrer" className="mt-1 text-sm text-blue-600 hover:underline">
              Avaa ilmoitus ↗
            </a>
          )}
          {h.paikka.kuvaus && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{h.paikka.kuvaus}</p>}

          <form onSubmit={tallennaToimenpide} className="mt-4 space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Seuraava toimenpide</h3>
            <input
              value={toimenpide}
              onChange={(e) => setToimenpide(e.target.value)}
              placeholder="Esim. lähetä seurantaviesti"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={toimenpidePvm}
                onChange={(e) => setToimenpidePvm(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button className="rounded bg-slate-800 px-3 py-1 text-sm text-white">Tallenna</button>
            </div>
          </form>

          <form onSubmit={lisaaMuistiinpano} className="mt-4 space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Lisää muistiinpano</h3>
            <textarea
              value={muistiinpano}
              onChange={(e) => setMuistiinpano(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button className="rounded bg-slate-800 px-3 py-1 text-sm text-white">Lisää</button>
          </form>

          <button
            type="button"
            onClick={onPoista}
            className="mt-4 self-start rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
          >
            Poista hakemus
          </button>

          <h3 className="mt-4 border-t pt-3 text-sm font-semibold">Tapahtumahistoria</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {[...h.tapahtumat].reverse().map((t) => (
              <li key={t.id} className="rounded bg-slate-50 p-2">
                <div className="text-xs text-slate-500">
                  {aikaFi(t.aika)} · {t.tyyppi}
                </div>
                <div className="whitespace-pre-wrap">{t.sisalto}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
