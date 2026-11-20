import type { Muistutukset } from "./api";
import { pvmFi } from "./pvm";

interface Props {
  muistutukset: Muistutukset;
  onValitse: (hakemusId: number) => void;
}

export function MuistutusPalkki({ muistutukset: m, onValitse }: Props) {
  const rivit: { avain: string; teksti: string; hakemusId: number | null; kiire: boolean }[] = [
    ...m.deadlinet.map((d) => ({
      avain: `d${d.paikka_id}`,
      teksti: `${d.yritys}: hakuaika ${d.paivia_jaljella <= 0 ? "päättyy tänään" : `päättyy ${d.paivia_jaljella} pv päästä`} (${pvmFi(d.deadline)})`,
      hakemusId: d.hakemus_id,
      kiire: d.paivia_jaljella <= 3,
    })),
    ...m.toimenpiteet.map((t) => ({
      avain: `t${t.hakemus_id}`,
      teksti: `${t.yritys}: ${t.toimenpide ?? "seuraava toimenpide"} ${t.myohassa ? "(myöhässä) " : ""}${pvmFi(t.pvm)}`,
      hakemusId: t.hakemus_id,
      kiire: t.myohassa,
    })),
    ...m.seuranta.map((s) => ({
      avain: `s${s.hakemus_id}`,
      teksti: `${s.yritys}: ei päivityksiä ${s.paivia_hiljaa} pv — harkitse seurantaviestiä`,
      hakemusId: s.hakemus_id,
      kiire: false,
    })),
  ];
  if (rivit.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
      <span className="shrink-0 font-medium text-amber-900">Muistutukset:</span>
      {rivit.map((r) => (
        <button
          key={r.avain}
          disabled={r.hakemusId === null}
          onClick={() => r.hakemusId !== null && onValitse(r.hakemusId)}
          className={`shrink-0 rounded px-2 py-0.5 ${r.kiire ? "bg-red-100 text-red-800" : "bg-white text-slate-700"} enabled:hover:underline`}
        >
          {r.teksti}
        </button>
      ))}
    </div>
  );
}
