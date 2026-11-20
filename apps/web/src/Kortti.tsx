import { useDraggable } from "@dnd-kit/core";
import type { HakemusRivi } from "./api";
import { paivaaJaljella, pvmFi } from "./pvm";

interface Props {
  hakemus: HakemusRivi;
  onValitse?: (id: number) => void;
  onPoista?: (hakemus: HakemusRivi) => void;
  /** Vedon aikainen kopio (DragOverlay) */
  ylapuolella?: boolean;
}

function DeadlineMerkki({ deadline }: { deadline: string }) {
  const paivia = paivaaJaljella(deadline);
  const vari =
    paivia < 0
      ? "bg-slate-200 text-slate-600"
      : paivia <= 3
        ? "bg-red-100 text-red-700"
        : paivia <= 7
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-600";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${vari}`}>DL {pvmFi(deadline)}</span>;
}

export function Kortti({ hakemus, onValitse, onPoista, ylapuolella }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: hakemus.id, disabled: ylapuolella });
  return (
    <article
      ref={ylapuolella ? undefined : setNodeRef}
      {...(ylapuolella ? {} : { ...listeners, ...attributes })}
      onClick={() => onValitse?.(hakemus.id)}
      className={`group relative cursor-grab rounded-md border border-slate-200 bg-white p-2.5 text-sm shadow-sm hover:border-blue-300 ${isDragging ? "opacity-30" : ""} ${ylapuolella ? "shadow-lg" : ""}`}
    >
      {onPoista && (
        <button
          type="button"
          aria-label={`Poista ${hakemus.yritys}`}
          title="Poista"
          onPointerDown={(e) => e.stopPropagation()} // ei aloita vetoa
          onClick={(e) => {
            e.stopPropagation(); // ei avaa paneelia
            onPoista(hakemus);
          }}
          className="absolute right-1 top-1 rounded px-1.5 text-slate-400 hover:bg-red-100 hover:text-red-700"
        >
          🗑
        </button>
      )}
      <div className="pr-6 font-medium">{hakemus.yritys}</div>
      <div className="text-slate-600">{hakemus.otsikko}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {hakemus.deadline && hakemus.tila !== "haettu" && <DeadlineMerkki deadline={hakemus.deadline} />}
        {hakemus.seuraava_pvm && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700" title={hakemus.seuraava_toimenpide ?? undefined}>
            ➜ {pvmFi(hakemus.seuraava_pvm)}
          </span>
        )}
      </div>
    </article>
  );
}
