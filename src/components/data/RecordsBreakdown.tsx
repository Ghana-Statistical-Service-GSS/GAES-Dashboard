"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ListTree, X } from "lucide-react";
import { useData } from "./DataProvider";
import { fmt, pct } from "@/lib/fmt";

const ORDER: { key: string; label: string; note: string }[] = [
  { key: "COMPLETE", label: "Completed", note: "Respondent reached and the questionnaire finished" },
  { key: "PARTIAL", label: "Partial", note: "Started but not finished" },
  { key: "CALLBACK", label: "Call-back requested", note: "Respondent asked to be called later" },
  { key: "LANGUAGE", label: "Language barrier", note: "Needs an interviewer in another language" },
  { key: "REFUSED", label: "Refused", note: "Respondent declined" },
  { key: "NO_ANSWER", label: "No answer", note: "Phone rang, nobody picked up" },
  { key: "UNREACHABLE", label: "Unreachable / wrong number", note: "Number does not work or is wrong" },
  { key: "SWITCHED_OFF", label: "Phone switched off", note: "" },
  { key: "CALL_DROPPED", label: "Call dropped", note: "" },
  { key: "NOT_STARTED", label: "Not started", note: "Record opened, nothing recorded yet" },
];

/**
 * Bold "total interview records" figure for the Overview banner, with a small button
 * that opens a modal reconciling the Survey Solutions total with the completed count.
 */
export default function RecordsBreakdown() {
  const { rows, activeFilterCount } = useData();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.disp, (m.get(r.disp) ?? 0) + 1);
    return m;
  }, [rows]);
  const total = rows.length;
  const complete = counts.get("COMPLETE") ?? 0;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  const list = ORDER.map((o) => ({ ...o, n: counts.get(o.key) ?? 0 })).filter((o) => o.n > 0 || o.key === "COMPLETE");

  return (
    <>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-white/85">
        <span>
          <b className="text-2xl font-extrabold tracking-tight text-white tabular-nums">{fmt(total)}</b> total interview records in Survey Solutions
          <span className="text-white/65"> — {fmt(complete)} completed, {fmt(total - complete)} other call outcomes</span>
        </span>
        <button className="hero-pill hero-pill-muted cursor-pointer border border-white/25 transition hover:bg-white/25" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <ListTree size={13} /> See breakdown
        </button>
      </p>

      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="records-title" className="card flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-start gap-3 border-b border-[var(--border)] px-6 py-4">
              <div>
                <div className="eyebrow">Interview records by outcome</div>
                <h3 id="records-title" className="mt-0.5 text-lg font-extrabold tracking-tight">{fmt(total)} records, of which {fmt(complete)} are completed interviews</h3>
              </div>
              <button ref={closeRef} className="icon-btn ml-auto shrink-0" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="table">
                <thead><tr><th>Outcome</th><th className="text-right">Records</th><th className="text-right">Share</th></tr></thead>
                <tbody>
                  {list.map((o) => {
                    const done = o.key === "COMPLETE";
                    return (
                      <tr key={o.key} className={done ? "bg-[var(--good-bg)]" : ""}>
                        <td>
                          <div className={`flex items-center gap-1.5 ${done ? "font-bold text-[var(--good)]" : "font-semibold"}`}>{done && <CheckCircle2 size={15} />}{o.label}</div>
                          {o.note && <div className="text-xs text-[var(--muted)]">{o.note}</div>}
                          <div className="bar-track mt-1.5 !h-1.5"><div className="bar-fill" style={{ width: `${total ? (o.n / total) * 100 : 0}%`, background: done ? "var(--good)" : "var(--gss-slate, #6b7a90)" }} /></div>
                        </td>
                        <td className={`text-right tabular-nums ${done ? "text-lg font-extrabold" : "font-semibold"}`}>{fmt(o.n)}</td>
                        <td className="text-right tabular-nums text-[var(--muted)]">{pct(total ? o.n / total : null, 1)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="font-extrabold">Total interview records</td>
                    <td className="text-right text-lg font-extrabold tabular-nums">{fmt(total)}</td>
                    <td className="text-right tabular-nums text-[var(--muted)]">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <footer className="border-t border-[var(--border)] px-6 py-3 text-xs text-[var(--muted)]">
              Survey Solutions creates an interview record for every establishment an interviewer calls, even when nobody answers.
              Progress against the sample target counts <b>completed</b> interviews only.
              {activeFilterCount > 0 && <> Counts follow the filters currently applied.</>}
            </footer>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
