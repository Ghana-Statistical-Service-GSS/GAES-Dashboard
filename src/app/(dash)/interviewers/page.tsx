"use client";

import { useMemo, useState } from "react";
import { Tablet, UserCheck } from "lucide-react";
import { useData } from "@/components/data/DataProvider";
import { Card, DataTable, Empty, InlineBar, Loading, PageHeader, tableCsv, type Col } from "@/components/ui/kit";
import EChart from "@/components/charts/EChart";
import TeamCards from "@/components/data/Teams";
import { axisStyle, baseOption, useChartTheme } from "@/components/ui/theme";
import { fmt, median, nums, pct } from "@/lib/fmt";
import type { InterviewerRow, TeamRow } from "@/lib/data/types";

const IB_NAME: Record<string, string> = {
  "DQ-IB-01": "Short interviews", "DQ-IB-02": "Round-number heaping", "DQ-IB-03": "Many critical flags", "DQ-IB-04": "High rejection rate",
  "DQ-IB-05": "Zero-filling", "DQ-IB-06": "Low yield", "DQ-IB-07": "Unusual refusals/non-contacts", "DQ-IB-08": "Near-identical interviews", "DQ-IB-09": "No recent activity",
};

export default function InterviewersPage() {
  const { data, rows, filters, setFilters } = useData();
  const t = useChartTheme();
  const [view, setView] = useState<"all" | "active" | "flagged">("active");

  const list = useMemo(() => {
    if (!data) return [];
    return data.interviewers
      .filter((i) => !filters.team || String(i.team) === filters.team)
      .filter((i) => !filters.interviewer || i.login === filters.interviewer)
      .filter((i) => view === "all" || (view === "active" ? i.attempted > 0 : i.flags.some((f) => f !== "DQ-IB-09")));
  }, [data, filters, view]);

  // average calls before completion per interviewer (question in v2+, supervisors' comments in v1)
  const callsBy = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of rows) if (r.calls !== null && r.interviewer) m.set(r.interviewer, [...(m.get(r.interviewer) ?? []), r.calls]);
    return m;
  }, [rows]);
  const avgCalls = (login: string) => {
    const xs = callsBy.get(login);
    return xs?.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };

  if (!data) return <Loading />;

  const cols: Col<InterviewerRow>[] = [
    { key: "login", label: "Interviewer", value: (r) => r.login, render: (r) => <div><div className="font-semibold">{r.login}</div><div className="max-w-[170px] truncate text-xs text-[var(--muted)]">{r.name ?? "–"}</div></div> },
    { key: "team", label: "Team", value: (r) => r.team, align: "center" },
    { key: "assigned", label: "Assigned", value: (r) => r.assigned, align: "right" },
    { key: "tablet", label: "On tablet", value: (r) => r.receivedOnTablet, align: "center", render: (r) => r.assigned ? (r.receivedOnTablet ? <Tablet size={15} className="mx-auto text-[var(--good)]" /> : <span className="chip chip-bad !text-[10px]">not synced</span>) : "–" },
    { key: "att", label: "Attempted", value: (r) => r.attempted, align: "right" },
    { key: "comp", label: "Completed", value: (r) => r.complete, align: "right", render: (r) => <span className="font-semibold">{r.complete}</span> },
    { key: "prog", label: "Progress", value: (r) => (r.assigned ? r.complete / r.assigned : null), render: (r) => <div className="flex items-center gap-2"><InlineBar value={r.complete} max={r.assigned || 1} /><span className="w-10 text-right text-xs tabular-nums">{pct(r.assigned ? r.complete / r.assigned : null, 1)}</span></div> },
    { key: "pd", label: "Per day", value: (r) => r.perDay, align: "right", render: (r) => <span title="Completes per day worked (target ≈ 4.1)">{fmt(r.perDay, 1)}</span> },
    { key: "coop", label: "Cooperation", value: (r) => r.coopRate, align: "right", render: (r) => pct(r.coopRate) },
    { key: "calls", label: "Avg calls", value: (r) => avgCalls(r.login), align: "right", render: (r) => <span title={`Average calls before completion, from ${callsBy.get(r.login)?.length ?? 0} interview(s) with a count`}>{fmt(avgCalls(r.login), 1)}</span> },
    { key: "dur", label: "Median min", value: (r) => r.medDuration, align: "right", render: (r) => fmt(r.medDuration, 1) },
    { key: "score", label: "Mean score", value: (r) => r.meanScore, align: "right", render: (r) => fmt(r.meanScore, 0) },
    { key: "iqi", label: "Quality index", value: (r) => r.iqi, align: "right", render: (r) => r.iqi === null ? <span className="text-xs text-[var(--muted)]">{r.complete ? "n<5" : "–"}</span> : <span className={`chip ${r.iqi >= 85 ? "chip-good" : r.iqi >= 70 ? "chip-warn" : "chip-bad"}`}>{r.iqi}<span className="opacity-60">·{r.complete}</span></span> },
    { key: "rej", label: "Rejected", value: (r) => r.rejections, align: "right" },
    { key: "flags", label: "Alerts", value: (r) => r.flags.join(" "), render: (r) => <div className="flex max-w-[200px] flex-wrap gap-1">{r.flags.map((f) => <span key={f} title={IB_NAME[f]} className={`chip ${f === "DQ-IB-09" ? "chip-muted" : "chip-accent"} !text-[10px]`}>{IB_NAME[f]}</span>)}</div> },
    { key: "last", label: "Last activity", value: (r) => r.lastActivity, render: (r) => <span className="text-xs">{r.lastActivity ?? "never"}</span> },
  ];

  const supCols: Col<TeamRow>[] = [
    { key: "sup", label: "Supervisor", value: (r) => r.supervisorName, render: (r) => <div><div className="font-semibold">{r.supervisorName}</div><div className="text-xs text-[var(--muted)]">Team {r.team} · {r.supervisor}</div></div> },
    { key: "await", label: "Awaiting review", value: (r) => r.awaitingReview, align: "right", render: (r) => <span className={r.awaitingReview > 20 ? "font-bold text-[#d17a22]" : ""}>{r.awaitingReview}</span> },
    { key: "rev", label: "Reviewed", value: (r) => r.reviewed, align: "right" },
    { key: "lag", label: "Median decision time", value: (r) => r.medDecisionLagH, align: "right", render: (r) => (r.medDecisionLagH !== null ? `${fmt(r.medDecisionLagH, 1)} h` : "–") },
    { key: "rr", label: "Rejection rate", value: (r) => r.rejectionRate, align: "right", render: (r) => pct(r.rejectionRate) },
    { key: "open", label: "Median review time", value: (r) => r.medOpenMin, align: "right", render: (r) => (r.medOpenMin !== null ? `${fmt(r.medOpenMin, 1)} min` : "–") },
    { key: "pr", label: "Weak approvals", value: (r) => data.flags.filter((f) => (f.check === "DQ-PR-04" || f.check === "DQ-PR-05") && f.team === r.team).length, align: "right" },
  ];

  const active = data.interviewers.filter((i) => i.attempted > 0);
  const perDay = nums(active, (i) => i.perDay);
  const topChart = (() => {
    const top = [...active].sort((a, b) => b.complete - a.complete).slice(0, 15);
    return {
      ...baseOption(t),
      grid: { left: 70, right: 40, top: 4, bottom: 4 },
      tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", show: false },
      yAxis: { type: "category", inverse: true, data: top.map((i) => i.login), ...axisStyle(t), axisLine: { show: false } },
      series: [
        { name: "Completed", type: "bar", stack: "a", barWidth: 12, data: top.map((i) => ({ value: i.complete, itemStyle: { borderRadius: i.attempted - i.complete > 0 ? [3, 0, 0, 3] : [3, 6, 6, 3] } })), itemStyle: { color: t.primary } },
        { name: "Other attempts", type: "bar", stack: "a", barWidth: 12, data: top.map((i) => i.attempted - i.complete), itemStyle: { color: t.dark ? "#3a3270" : "#d6d2f2", borderRadius: [0, 6, 6, 0] }, label: { show: true, position: "right", color: t.text, formatter: (p: { dataIndex: number }) => `${top[p.dataIndex].complete}/${top[p.dataIndex].attempted}` } },
      ],
    };
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Interviewers & teams" sub={`${data.interviewers.length} interviewers in 5 teams, each led by a supervisor (${data.teams.map((x) => x.supervisorName).join(", ")}). Targets come from the assignments loaded in Survey Solutions.`} />

      <TeamCards detailed filterable />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Most productive interviewers" sub="Completed (purple) out of all attempts" className="xl:col-span-2">
          {active.length ? <EChart option={topChart} height={Math.min(15, active.length) * 26 + 20} onClick={(p) => { const n = (p as { name?: string }).name; if (n) setFilters({ ...filters, interviewer: n }); }} /> : <Empty />}
        </Card>
        <Card title="Field force at a glance">
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between"><span className="text-[var(--muted)]">Interviewers who have started</span><b>{active.length} / {data.interviewers.length}</b></li>
            <li className="flex justify-between"><span className="text-[var(--muted)]">Assignments not yet on a tablet</span><b>{data.interviewers.filter((i) => i.assigned && !i.receivedOnTablet).length} interviewers</b></li>
            <li className="flex justify-between"><span className="text-[var(--muted)]">Median completes per day worked</span><b>{fmt(median(perDay), 1)}</b></li>
            <li className="flex justify-between"><span className="text-[var(--muted)]">Needed per interviewer per day</span><b>≈ {fmt(data.targets.national / Math.max(1, data.survey.workdays.length) / data.survey.interviewersTotal, 1)}</b></li>
            <li className="flex justify-between"><span className="text-[var(--muted)]">With behaviour alerts</span><b>{data.interviewers.filter((i) => i.flags.some((f) => f !== "DQ-IB-09")).length}</b></li>
          </ul>
        </Card>
      </div>

      <Card title={<span className="flex items-center gap-2"><UserCheck size={17} /> Interviewers ({list.length})</span>} sub="Click column headers to sort. Quality index needs 5+ completed interviews." pad={false}
        csv={() => tableCsv(list, cols)} csvName="gaes-interviewers"
        actions={<div className="flex gap-1">{(["active", "flagged", "all"] as const).map((v) => <button key={v} className={`pill capitalize ${view === v ? "pill-on" : ""}`} onClick={() => setView(v)}>{v === "active" ? "Started" : v === "flagged" ? "With alerts" : "All"}</button>)}</div>}>
        <DataTable rows={list} cols={cols} rowKey={(r) => r.login} initialSort="comp" pageSize={20} compact
          onRow={(r) => setFilters({ ...filters, interviewer: filters.interviewer === r.login ? "" : r.login })} />
      </Card>

      <Card id="supervisors" title="Supervisors" sub="Review workload and speed. Weak approvals = approved with blank review questions, under 2 minutes of review, or with open critical flags." pad={false}
        csv={() => tableCsv(data.teams, supCols)} csvName="gaes-supervisors">
        <DataTable rows={data.teams} cols={supCols} rowKey={(r) => r.supervisor} pageSize={10} />
      </Card>
    </div>
  );
}
