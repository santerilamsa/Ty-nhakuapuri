import { useState, type FormEvent } from "react";
import { api, type UusiPaikka } from "./api";

interface Props {
  onSulje: () => void;
  onLisatty: () => void;
}

export function LisaaPaikka({ onSulje, onLisatty }: Props) {
  const [virhe, setVirhe] = useState<string | null>(null);
  const [kesken, setKesken] = useState(false);

  async function laheta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lomake = new FormData(e.currentTarget);
    const syote: UusiPaikka = { yritys: "", otsikko: "" };
    for (const kentta of ["yritys", "otsikko", "url", "sijainti", "kuvaus", "deadline"] as const) {
      const arvo = String(lomake.get(kentta) ?? "").trim();
      if (arvo) syote[kentta] = arvo;
    }
    setKesken(true);
    try {
      await api.lisaaPaikka(syote);
      onLisatty();
    } catch (err) {
      setVirhe(err instanceof Error ? err.message : String(err));
      setKesken(false);
    }
  }

  const kentta = "w-full rounded border border-slate-300 px-2 py-1.5 text-sm";
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onSulje}>
      <form onSubmit={laheta} onClick={(e) => e.stopPropagation()} className="w-96 space-y-3 rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Lisää paikka</h2>
        {virhe && (
          <p role="alert" className="rounded bg-red-100 p-2 text-sm text-red-800">
            {virhe}
          </p>
        )}
        <input name="yritys" required placeholder="Yritys *" className={kentta} />
        <input name="otsikko" required placeholder="Otsikko *" className={kentta} />
        <input name="url" type="url" placeholder="Ilmoituksen linkki" className={kentta} />
        <input name="sijainti" placeholder="Sijainti" className={kentta} />
        <textarea name="kuvaus" rows={3} placeholder="Kuvaus" className={kentta} />
        <label className="block text-sm text-slate-600">
          Hakuaika päättyy
          <input name="deadline" type="date" className={`${kentta} mt-1`} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onSulje} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Peruuta
          </button>
          <button disabled={kesken} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Lisää
          </button>
        </div>
      </form>
    </div>
  );
}
