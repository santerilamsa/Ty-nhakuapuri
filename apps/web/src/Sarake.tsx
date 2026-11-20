import { useDroppable } from "@dnd-kit/core";
import { TILA_NIMI, type HakemusRivi, type Tila } from "./api";
import { Kortti } from "./Kortti";

interface Props {
  tila: Tila;
  hakemukset: HakemusRivi[];
  /** False kun vedettävää korttia ei saa pudottaa tähän sarakkeeseen. */
  sallittu: boolean;
  onValitse: (id: number) => void;
}

export function Sarake({ tila, hakemukset, sallittu, onValitse }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: tila, disabled: !sallittu });
  const tausta = !sallittu ? "opacity-40" : isOver ? "bg-blue-100 ring-2 ring-blue-400" : "bg-slate-200/60";
  return (
    <section ref={setNodeRef} className={`flex w-64 shrink-0 flex-col rounded-lg p-2 transition ${tausta}`}>
      <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-700">
        {TILA_NIMI[tila]}
        <span className="rounded-full bg-white px-2 text-xs font-normal text-slate-500">{hakemukset.length}</span>
      </h2>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {hakemukset.map((h) => (
          <Kortti key={h.id} hakemus={h} onValitse={onValitse} />
        ))}
      </div>
    </section>
  );
}
