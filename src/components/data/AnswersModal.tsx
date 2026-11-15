"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertOctagon, AlertTriangle, ExternalLink, EyeOff, Search, X } from "lucide-react";
import { useData } from "./DataProvider";
import { BandChip, SevChip } from "@/components/ui/kit";
import { CHECK_VARS } from "@/lib/data/checkVars";
import type { Flag } from "@/lib/data/types";

interface Item {
  variable: string;
  label: string;
  section: string;
  value: string | null;
  state: "answered" | "unanswered" | "skipped" | "hidden";
}
interface Payload {
  key: string;
  sections: { key: string; title: string }[];
  items: Item[];
}

const RANK: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };

/** Browse every answer of one interview; flagged answers are marked, critical problems shown first. */
export default function AnswersModal() {
  const { data, answersId, setAnswersId } = useData();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!answersId) return;
    setPayload(null);
    setErr(null);
    setQ("");
    setOnlyFlagged(false);
    let live = true;
    fetch(`/api/interview/${answersId}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!live) return;
        if (!r.ok) setErr(j.error || "Could not load the answers");
        else setPayload(j);
      })
      .catch(() => live && setErr("Could not load the answers"));
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAnswersId(null);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [answersId, setAnswersId]);

  const rec = useMemo(
    () => (answersId && data ? data.records.find((r) => r.id === answersId) ?? data.excludedRecords?.find((r) => r.id === answersId) ?? null : null),
    [answersId, data]
  );
  const flags = useMemo(
    () => (data && answersId ? data.flags.filter((f) => f.iid === answersId && f.sev !== "info").sort((a, b) => RANK[a.sev] - RANK[b.sev]) : []),
    [data, answersId]
  );
  const byVar = useMemo(() => {
    const m = new Map<string, Flag[]>();
    for (const f of flags) for (const v of CHECK_VARS[f.check] ?? []) m.set(v, [...(m.get(v) ?? []), f]);
    return m;
  }, [flags]);

  if (!answersId || !data) return null;
  const checkName = (id: string) => data.checks.find((c) => c.id === id)?.name ?? id;
  const critical = flags.filter((f) => f.sev === "critical");
  const others = flags.filter((f) => f.sev !== "critical");
  const needle = q.trim().toLowerCase();
  const visible = (payload?.items ?? []).filter((it) =>
    (showSkipped || it.state !== "skipped") &&
    (!onlyFlagged || byVar.has(it.variable)) &&
    (!needle || `${it.label} ${it.variable} ${it.value ?? ""}`.toLowerCase().includes(needle))
  );
  const answered = (payload?.items ?? []).filter((it) => it.state === "answered" || it.state === "hidden").length;
  const skipped = (payload?.items ?? []).filter((it) => it.state === "skipped").length;

  return (
    <div className="modal-backdrop !z-[70]" onClick={() => setAnswersId(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="answers-title" className="card flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="eyebrow">All answers · interview <span className="font-mono">{rec?.key ?? payload?.key}</span></div>
            <h3 id="answers-title" className="mt-0.5 truncate text-lg font-extrabold tracking-tight">{rec?.estName ?? "Establishment details hidden"}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
              {rec && <BandChip band={rec.band} />}
              {rec?.score !== null && rec?.score !== undefined && <span className="chip chip-primary">Score {rec.score}/100</span>}
              {rec?.interviewer && <span>{data.interviewerNames[rec.interviewer] ?? rec.interviewer} · {rec.interviewer}</span>}
              {payload && <span>· {answered} answers</span>}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {rec && data.viewer.role !== "viewer" && (
              <a className="btn btn-ghost btn-sm max-sm:hidden" href={rec.reviewUrl} target="_blank" rel="noreferrer">Survey Solutions <ExternalLink size={13} /></a>
            )}
            <button ref={closeRef} className="icon-btn" onClick={() => setAnswersId(null)} aria-label="Close"><X size={18} /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {/* ---- problems first ---- */}
          <div className="space-y-2 px-5 pt-4 sm:px-6">
            {critical.length > 0 ? (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[var(--bad-bg)] p-4" role="alert">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--bad)]"><AlertOctagon size={17} /> {critical.length} critical error{critical.length > 1 ? "s" : ""} — resolve before approval</div>
                <ul className="mt-2 space-y-1.5">
                  {critical.map((f, k) => (
                    <li key={k} className="text-sm"><b>{checkName(f.check)}.</b> {f.msg} <span className="font-mono text-[11px] text-[var(--muted)]">{f.check}</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="notice notice-ok">No critical errors on this interview.</div>
            )}
            {others.length > 0 && (
              <details className="rounded-xl border border-[var(--border)] p-3" open={critical.length === 0 && others.length <= 4}>
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><AlertTriangle size={15} className="text-[#d17a22]" /> {others.length} other issue{others.length > 1 ? "s" : ""} to review</summary>
                <ul className="mt-2 space-y-1.5">
                  {others.map((f, k) => (
                    <li key={k} className="flex items-start gap-2 text-sm"><SevChip sev={f.sev} /><span><b>{checkName(f.check)}.</b> <span className="text-[var(--muted)]">{f.msg}</span></span></li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* ---- tools ---- */}
          <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 sm:px-6">
            <div className="input-icon min-w-[180px] flex-1">
              <Search size={15} />
              <input className="input input-sm" placeholder="Search questions or answers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search answers" />
            </div>
            {byVar.size > 0 && (
              <label className="flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" className="accent-[var(--gss-primary)]" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Flagged answers only</label>
            )}
            <label className="flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" className="accent-[var(--gss-primary)]" checked={showSkipped} onChange={(e) => setShowSkipped(e.target.checked)} /> Show {skipped} skipped</label>
          </div>

          {/* ---- answers ---- */}
          <div className="px-5 pb-6 sm:px-6">
            {err && <div className="notice notice-bad mt-4">{err}</div>}
            {!payload && !err && <div className="mt-4 space-y-2">{Array.from({ length: 8 }).map((_, k) => <div key={k} className="skeleton h-10" />)}</div>}
            {payload && visible.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">No answers match.</p>}
            {payload?.sections.map((sec) => {
              const its = visible.filter((it) => it.section === sec.key);
              if (!its.length) return null;
              return (
                <section key={sec.key} className="mt-5">
                  <h4 className="eyebrow mb-1.5 !text-[var(--gss-primary-2)]">{sec.title}</h4>
                  <dl className="overflow-hidden rounded-xl border border-[var(--border)]">
                    {its.map((it) => {
                      const fl = byVar.get(it.variable);
                      const worst = fl?.[0]?.sev;
                      const tone = worst === "critical" ? "border-l-[var(--bad)] bg-[var(--bad-bg)]" : worst ? "border-l-[#d17a22] bg-[var(--warn-bg)]" : "border-l-transparent";
                      return (
                        <div key={it.variable} className={`grid grid-cols-1 gap-x-4 gap-y-0.5 border-b border-l-4 border-b-[var(--border)] px-3.5 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,42%)] ${tone}`}>
                          <dt className="text-[13px] leading-snug">
                            {it.label}
                            <span className="ml-1.5 font-mono text-[10.5px] text-[var(--muted)]">{it.variable}</span>
                          </dt>
                          <dd className="text-[13px] font-semibold tabular-nums sm:text-right">
                            {it.state === "answered" ? <span className="break-words">{it.value}</span>
                              : it.state === "hidden" ? <span className="inline-flex items-center gap-1 font-normal text-[var(--muted)]"><EyeOff size={12} /> Hidden for your role</span>
                              : it.state === "unanswered" ? <span className="chip chip-warn">Not answered</span>
                              : <span className="font-normal text-[var(--muted)]">Skipped (not applicable)</span>}
                          </dd>
                          {fl && (
                            <div className="mt-1 flex flex-wrap gap-1 sm:col-span-2">
                              {fl.map((f, k) => <span key={k} className={`chip ${f.sev === "critical" ? "chip-bad" : f.sev === "major" ? "chip-accent" : "chip-warn"} !whitespace-normal !text-[11px]`} title={f.msg}>{f.sev === "critical" ? "Critical: " : ""}{checkName(f.check)}</span>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
