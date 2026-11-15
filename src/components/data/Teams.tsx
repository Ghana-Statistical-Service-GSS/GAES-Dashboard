"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Download, Filter, Users2, X } from "lucide-react";
import { useData } from "./DataProvider";
import { downloadText, fmt, pct, toCSV } from "@/lib/fmt";
import type { TeamRow } from "@/lib/data/types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

interface Member {
  login: string;
  name: string | null;
  assigned: number;
  attempted: number;
  complete: number;
  rate: number | null;
}

/** Per-team counts from the interviews currently in view (respects the global filters). */
function useTeamStats() {
  const { data, rows } = useData();
  return useMemo(() => {
    const att = new Map<string, number>();
    const comp = new Map<string, number>();
    const teamAtt = new Map<number, number>();
    const teamComp = new Map<number, number>();
    for (const r of rows) {
      if (r.disp === "NOT_STARTED") continue;
      if (r.interviewer) att.set(r.interviewer, (att.get(r.interviewer) ?? 0) + 1);
      if (r.team !== null) teamAtt.set(r.team, (teamAtt.get(r.team) ?? 0) + 1);
      if (r.disp === "COMPLETE") {
        if (r.interviewer) comp.set(r.interviewer, (comp.get(r.interviewer) ?? 0) + 1);
        if (r.team !== null) teamComp.set(r.team, (teamComp.get(r.team) ?? 0) + 1);
      }
    }
    const members = (team: number): Member[] =>
      (data?.interviewers ?? [])
        .filter((i) => i.team === team)
        .map((i) => {
          const complete = comp.get(i.login) ?? 0;
          return { login: i.login, name: i.name, assigned: i.assigned, attempted: att.get(i.login) ?? 0, complete, rate: i.assigned ? complete / i.assigned : null };
        })
        .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.complete - a.complete || b.attempted - a.attempted || a.login.localeCompare(b.login));
    return { teamAtt, teamComp, members };
  }, [data, rows]);
}

/**
 * Team cards: who is in charge and how many interviews each team has done.
 * "View team members" opens a modal with every interviewer's completion rate.
 */
export default function TeamCards({ detailed = false, filterable = false }: { detailed?: boolean; filterable?: boolean }) {
  const { data, filters, setFilters } = useData();
  const stats = useTeamStats();
  const [open, setOpen] = useState<TeamRow | null>(null);
  if (!data) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.teams.map((tm) => {
          const comp = stats.teamComp.get(tm.team) ?? 0;
          const att = stats.teamAtt.get(tm.team) ?? 0;
          const sel = filters.team === String(tm.team);
          const active = stats.members(tm.team).filter((m) => m.attempted > 0).length;
          return (
            <article key={tm.team} className={`card fade-up flex flex-col p-5 ${sel ? "!border-[var(--gss-primary)] ring-2 ring-[var(--gss-soft)]" : ""}`}>
              <div className="eyebrow">Team {tm.team}</div>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="team-avatar" aria-hidden>{initials(tm.supervisorName)}</span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-bold" title={tm.supervisorName}>{tm.supervisorName}</div>
                  <div className="text-[11px] text-[var(--muted)]">Supervisor in charge</div>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-1.5">
                <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums">{fmt(comp)}</span>
                <span className="pb-0.5 text-sm font-semibold text-[var(--muted)]">completed</span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)] tabular-nums">of {fmt(tm.target)} assigned · {pct(tm.target ? comp / tm.target : null, 1)}</div>
              <div className="bar-track mt-2" role="img" aria-label={`Team ${tm.team} has completed ${pct(tm.target ? comp / tm.target : null, 1)} of its assignments`}>
                <div className="bar-fill" style={{ width: `${tm.target ? Math.min(100, (comp / tm.target) * 100) : 0}%` }} />
              </div>

              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-xs">
                <dt className="text-[var(--muted)]">Attempted</dt><dd className="text-right font-semibold tabular-nums">{fmt(att)}</dd>
                <dt className="text-[var(--muted)]">Interviewers active</dt><dd className="text-right font-semibold tabular-nums">{active} / {tm.interviewers}</dd>
                {detailed && <>
                  <dt className="text-[var(--muted)]">Mean quality score</dt><dd className="text-right font-semibold tabular-nums">{fmt(tm.meanScore, 0)}</dd>
                  <dt className="text-[var(--muted)]">Awaiting review</dt><dd className="text-right font-semibold tabular-nums">{tm.awaitingReview}</dd>
                  <dt className="text-[var(--muted)]">Review time</dt><dd className="text-right font-semibold tabular-nums">{tm.medDecisionLagH !== null ? `${fmt(tm.medDecisionLagH, 0)} h` : "–"}</dd>
                </>}
              </dl>

              <div className="mt-auto space-y-2 pt-4">
                <button className="btn btn-primary btn-sm w-full justify-center" onClick={() => setOpen(tm)} aria-label={`View Team ${tm.team} members and their completion rates`}>
                  <Users2 size={14} className="shrink-0" /> View members <ChevronRight size={14} className="shrink-0" />
                </button>
                {filterable && (
                  <button className="btn btn-ghost btn-sm w-full justify-center" aria-pressed={sel} onClick={() => setFilters({ ...filters, team: sel ? "" : String(tm.team) })}>
                    <Filter size={13} className="shrink-0" /> {sel ? "Clear filter" : "Filter to team"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {open && (
        <TeamModal team={open} members={stats.members(open.team)} completed={stats.teamComp.get(open.team) ?? 0} attempted={stats.teamAtt.get(open.team) ?? 0} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function TeamModal({ team, members, completed, attempted, onClose }: { team: TeamRow; members: Member[]; completed: number; attempted: number; onClose: () => void }) {
  const { activeFilterCount } = useData();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  const best = Math.max(0, ...members.map((m) => m.rate ?? 0));
  const started = members.filter((m) => m.attempted > 0).length;
  const teamRate = team.target ? completed / team.target : null;

  const csv = () =>
    downloadText(
      `gaes-team-${team.team}-completion.csv`,
      toCSV(members.map((m) => ({ team: team.team, supervisor: team.supervisorName, interviewer: m.name ?? "", login: m.login, assigned: m.assigned, attempted: m.attempted, completed: m.complete, completion_rate: m.rate === null ? "" : Math.round(m.rate * 1000) / 1000 })))
    );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="team-modal-title" className="card flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-[var(--border)] px-6 py-4">
          <span className="team-avatar !h-11 !w-11 !text-sm" aria-hidden>{initials(team.supervisorName)}</span>
          <div className="min-w-0">
            <div className="eyebrow">Team {team.team} · completion by interviewer</div>
            <h3 id="team-modal-title" className="mt-0.5 truncate text-lg font-extrabold tracking-tight">Led by {team.supervisorName}</h3>
          </div>
          <button ref={closeRef} className="icon-btn ml-auto shrink-0" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-3 sm:grid-cols-4">
          <Stat v={fmt(completed)} l="completed" />
          <Stat v={fmt(team.target)} l="assigned" />
          <Stat v={pct(teamRate, 1)} l="team completion rate" />
          <Stat v={`${started} / ${members.length}`} l="interviewers started" />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="table table-compact">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Interviewer</th>
                <th className="hidden text-right sm:table-cell">Assigned</th>
                <th className="hidden text-right sm:table-cell">Attempted</th>
                <th className="text-right">Completed</th>
                <th className="max-sm:text-right sm:min-w-[150px]"><span className="sm:hidden">Rate</span><span className="max-sm:hidden">Completion rate</span></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, k) => (
                <tr key={m.login} className={m.attempted ? "" : "text-[var(--muted)]"}>
                  <td className="tabular-nums text-[var(--muted)]">{k + 1}</td>
                  <td>
                    <div className="font-semibold">{m.name ?? m.login}</div>
                    <div className="text-[11px] text-[var(--muted)]">{m.login}<span className="sm:hidden"> · {fmt(m.attempted)} attempted of {fmt(m.assigned)}</span></div>
                  </td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{fmt(m.assigned)}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{fmt(m.attempted)}</td>
                  <td className="text-right font-semibold tabular-nums">{fmt(m.complete)}</td>
                  <td className="max-sm:text-right">
                    {m.attempted === 0 ? (
                      <span className="chip chip-muted">Not started</span>
                    ) : (
                      <div className="flex items-center gap-2 max-sm:justify-end">
                        <div className="bar-track flex-1 max-sm:hidden"><div className="bar-fill" style={{ width: `${best ? Math.max(m.complete ? 4 : 0, ((m.rate ?? 0) / best) * 100) : 0}%` }} /></div>
                        <span className="w-12 text-right text-xs font-semibold tabular-nums">{pct(m.rate, 1)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!members.length && <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">No interviewers to show for this team.</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-3">
          <p className="max-w-md text-xs text-[var(--muted)]">
            Completion rate = completed interviews ÷ establishments assigned to the interviewer.
            {best > 0 && <> Bar length is relative to the team&apos;s best ({pct(best, 1)}).</>}
            {activeFilterCount > 0 && <> Counts follow the filters currently applied.</>}
          </p>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={csv}><Download size={14} /> CSV</button>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <div className="text-xl font-extrabold leading-tight tabular-nums">{v}</div>
      <div className="text-[11px] text-[var(--muted)]">{l}</div>
    </div>
  );
}
