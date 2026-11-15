"use client";

import { Fragment } from "react";
import { PhoneOutgoing, Layers } from "lucide-react";
import { useData } from "./DataProvider";
import { Card, Empty } from "@/components/ui/kit";
import EChart from "@/components/charts/EChart";
import { axisStyle, baseOption, useChartTheme } from "@/components/ui/theme";
import { fmt, mean, median, pct, shortDate } from "@/lib/fmt";
import type { Rec } from "@/lib/data/types";

const BINS = ["1 call", "2 calls", "3 calls", "4 calls", "5 or more"];

function stats(rs: Rec[]) {
  const comp = rs.filter((r) => r.disp === "COMPLETE");
  const withCount = comp.filter((r) => r.calls !== null);
  const xs = withCount.map((r) => r.calls as number);
  return {
    complete: comp.length, n: xs.length, mean: mean(xs), median: median(xs),
    first: xs.length ? xs.filter((x) => x === 1).length / xs.length : null,
    total: xs.reduce((a, b) => a + b, 0),
    fromQuestion: withCount.filter((r) => r.callsSrc === "question").length,
    fromComment: withCount.filter((r) => r.callsSrc === "comment").length,
    bins: BINS.map((_, k) => xs.filter((x) => (k === 4 ? x >= 5 : x === k + 1)).length),
  };
}

/** How many calls it took to complete an interview (question in v2+, supervisors' comments in v1). */
export function CallAttemptsCard({ className = "" }: { className?: string }) {
  const { data, rows } = useData();
  const t = useChartTheme();
  if (!data) return null;
  const s = stats(rows);
  const since = data.calls?.sinceVersion ?? null;
  const teams = data.teams.map((tm) => ({ tm, s: stats(rows.filter((r) => r.team === tm.team)) })).filter((x) => x.s.complete > 0);

  const chart = {
    ...baseOption(t),
    grid: { left: 36, right: 8, top: 22, bottom: 26 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (p: { name: string; value: number }[]) => `${p[0].name}: <b>${p[0].value}</b> interviews (${pct(p[0].value / Math.max(1, s.n))})` },
    xAxis: { type: "category", data: BINS, ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, interval: 0 } },
    yAxis: { type: "value", minInterval: 1, ...axisStyle(t) },
    series: [{ type: "bar", barMaxWidth: 44, data: s.bins, itemStyle: { color: t.primary, borderRadius: [5, 5, 0, 0] }, label: { show: true, position: "top", color: t.text, fontWeight: 700 } }],
  };

  return (
    <Card className={className} title={<span className="flex items-center gap-2"><PhoneOutgoing size={16} /> Calls needed to complete an interview</span>}
      sub="How many times the interviewer called the establishment before the interview was completed"
      csv={() => rows.filter((r) => r.disp === "COMPLETE").map((r) => ({ interview: r.key, interviewer: r.interviewer, team: r.team, region: r.region, questionnaire_version: r.qv, call_attempts: r.calls, source: r.callsSrc ?? "not recorded" }))} csvName="gaes-call-attempts">
      {s.n === 0 ? (
        <Empty title="No call counts yet" sub={since ? `The question was added in questionnaire version ${since}; counts appear as version ${since} interviews are completed.` : "The questionnaire does not ask this yet."} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-2xl font-bold tabular-nums">{fmt(s.mean, 1)}</div><div className="text-xs text-[var(--muted)]">average calls per completed interview</div></div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-2xl font-bold tabular-nums">{pct(s.first)}</div><div className="text-xs text-[var(--muted)]">completed on the first call</div></div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-2xl font-bold tabular-nums">{fmt(s.n)}<span className="text-sm font-semibold text-[var(--muted)]"> / {fmt(s.complete)}</span></div><div className="text-xs text-[var(--muted)]">completed interviews with a count</div></div>
          </div>
          <div className="mt-3 grid gap-4 2xl:grid-cols-2">
            <EChart option={chart} height={200} />
            <div className="overflow-x-auto">
              <table className="table table-compact">
                <thead><tr><th>Team</th><th className="text-right max-sm:hidden">Counted</th><th className="text-right">Avg calls</th><th className="text-right">1st call</th></tr></thead>
                <tbody>
                  {teams.map(({ tm, s: x }) => (
                    <tr key={tm.team}>
                      <td className="whitespace-nowrap"><div className="font-semibold">Team {tm.team}</div><div className="text-xs text-[var(--muted)]">{tm.supervisorName}</div></td>
                      <td className="text-right tabular-nums max-sm:hidden">{x.n} / {x.complete}</td>
                      <td className="text-right font-semibold tabular-nums">{x.n ? fmt(x.mean, 1) : "–"}</td>
                      <td className="text-right tabular-nums">{x.n ? pct(x.first) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        {since ? <>From questionnaire version {since} the interviewer answers this as a question ({fmt(s.fromQuestion)} interviews). </> : null}
        For earlier interviews the number is read from the comment the supervisor wrote when approving, for example “call attempt was 2” ({fmt(s.fromComment)} interviews).
        {s.complete - s.n > 0 && <> {fmt(s.complete - s.n)} completed interviews have no count because nothing was written.</>}
        {s.n > 0 && s.n < 30 && <> With only {s.n} counts so far, treat the averages as indicative.</>}
      </p>
    </Card>
  );
}

/** Which questionnaire versions are on the server and how their interviews were merged. */
export function VersionsCard({ className = "" }: { className?: string }) {
  const { data, rows } = useData();
  if (!data) return null;
  const qs = data.questionnaires;
  return (
    <Card className={className} title={<span className="flex items-center gap-2"><Layers size={16} /> Questionnaire versions</span>}
      sub={qs.length > 1 ? `${qs.length} versions are on the server. Their interviews are merged into one dataset; any new version is added automatically.` : "One version on the server. A new version is added automatically when it is imported."} pad={false}>
      <div className="overflow-x-auto">
        <table className="table table-compact">
          <thead><tr><th>Version</th><th className="text-right">Records</th><th className="text-right">Completed</th></tr></thead>
          <tbody>
            {qs.map((q) => {
              const mine = rows.filter((r) => r.qv === q.version);
              return (
                <Fragment key={q.id}>
                  <tr>
                    <td className="whitespace-nowrap !border-b-0"><div className="font-semibold">Version {q.version}</div><div className="text-xs text-[var(--muted)]">{q.firstDate ? (q.firstDate === q.lastDate ? shortDate(q.firstDate) : `${shortDate(q.firstDate)} – ${shortDate(q.lastDate!)}`) : "no interviews yet"}</div></td>
                    <td className="!border-b-0 text-right tabular-nums">{fmt(mine.length)}</td>
                    <td className="!border-b-0 text-right font-semibold tabular-nums">{fmt(mine.filter((r) => r.disp === "COMPLETE").length)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="!pt-0 text-xs !whitespace-normal">
                      {q.added.length === 0 && q.removed.length === 0 ? <span className="text-[var(--muted)]">{q === qs[0] ? "Original questionnaire" : "No change to the questions"}</span> : null}
                      {q.added.map((a) => <div key={a.variable}><span className="chip chip-good !text-[10px]">New question</span> {a.label} <span className="font-mono text-[10.5px] text-[var(--muted)]">{a.variable}</span></div>)}
                      {q.removed.length > 0 && <div><span className="chip chip-muted !text-[10px]">Removed</span> <span className="font-mono text-[10.5px]">{q.removed.join(", ")}</span></div>}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {qs.length > 1 && (
              <tr>
                <td className="whitespace-nowrap font-extrabold">All versions</td>
                <td className="text-right font-extrabold tabular-nums">{fmt(rows.length)}</td>
                <td className="text-right font-extrabold tabular-nums">{fmt(rows.filter((r) => r.disp === "COMPLETE").length)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
