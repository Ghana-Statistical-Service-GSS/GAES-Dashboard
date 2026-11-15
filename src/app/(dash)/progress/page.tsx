"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronRight, PhoneCall } from "lucide-react";
import { useData } from "@/components/data/DataProvider";
import { CallAttemptsCard, VersionsCard } from "@/components/data/CallAttempts";
import { Card, ChartCard, DataTable, Empty, InlineBar, Kpi, Loading, PageHeader, tableCsv, type Col } from "@/components/ui/kit";
import EChart from "@/components/charts/EChart";
import { accentFor, axisStyle, baseOption, DISP_COLOR, MODE_COLOR, useChartTheme } from "@/components/ui/theme";
import { cumulative, daily, paceOf, surveyDays, targetFor } from "@/lib/series";
import { countBy, fmt, groupBy, median, nums, pct, quantile, shortDate, titleCase } from "@/lib/fmt";
import type { Rec } from "@/lib/data/types";

const GROUPS = ["Complete", "Partial", "Pending", "Refused", "Non-contact"];
const MODE_NAME: Record<string, string> = { "1": "CATI", "2": "CAPI", "3": "Web" };

export default function ProgressPage() {
  const { data, rows, filters, setFilters, setSelected } = useData();
  const t = useChartTheme();
  const [openRegion, setOpenRegion] = useState<string | null>(null);

  const m = useMemo(() => {
    if (!data) return null;
    const days = surveyDays(data);
    const pace = paceOf(data);
    const target = targetFor(data, filters);
    const att = rows.filter((r) => r.disp !== "NOT_STARTED");
    const comp = rows.filter((r) => r.disp === "COMPLETE");
    const g = countBy(att, (r) => r.dispGroup);
    const contacted = (g.get("Complete") ?? 0) + (g.get("Partial") ?? 0) + (g.get("Refused") ?? 0) + (g.get("Pending") ?? 0);
    const coopDen = (g.get("Complete") ?? 0) + (g.get("Partial") ?? 0) + (g.get("Refused") ?? 0);
    const dc = daily(comp, days, (r) => r.completeDate);
    const da = daily(att, days, (r) => r.date);
    const perDay = target.value ? target.value / Math.max(1, pace.total) : null;
    let req = 0;
    const required = days.map((d) => (pace.workdays.includes(d) && perDay ? (req += perDay) : req));
    return { days, pace, target, att, comp, g, contacted, coopDen, dc, da, required };
  }, [data, rows, filters]);

  if (!data || !m) return <Loading />;

  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const trend = {
    ...baseOption(t),
    legend: { bottom: 0, left: "center", textStyle: { color: t.muted }, itemWidth: 14, itemHeight: 8 },
    grid: { left: 44, right: narrow ? 48 : 96, top: 34, bottom: narrow ? 80 : 56 },
    tooltip: { ...t.tooltip, trigger: "axis" },
    xAxis: { type: "category", data: m.days.map(shortDate), ...axisStyle(t) },
    yAxis: [
      { type: "value", name: "per day", nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t) },
      { type: "value", name: "cumulative", nameTextStyle: { color: t.muted, fontSize: 11 }, ...axisStyle(t), splitLine: { show: false } },
    ],
    series: [
      { name: "Attempted", type: "bar", data: m.da, barGap: "-100%", barMaxWidth: 30, itemStyle: { color: t.dark ? "#2a2648" : "#e3e0f7", borderRadius: [5, 5, 0, 0] } },
      { name: "Completed", type: "bar", data: m.dc, barMaxWidth: 30, itemStyle: { color: t.primary, borderRadius: [5, 5, 0, 0] } },
      { name: "Cumulative completes", type: "line", yAxisIndex: 1, data: cumulative(m.dc), smooth: 0.25, symbol: "circle", symbolSize: 8, z: 5, lineStyle: { width: 3, color: t.palette[1] }, itemStyle: { color: t.palette[1], borderColor: t.surface, borderWidth: 2 }, endLabel: { show: !narrow, distance: 14, formatter: (p: { value: number }) => `${fmt(p.value)} done`, color: t.palette[1], fontWeight: 700, fontSize: 12 } },
      ...(m.target.value ? [{ name: "Required pace", type: "line", yAxisIndex: 1, data: m.required, symbol: "none", itemStyle: { color: t.bad }, lineStyle: { width: 2, type: "dashed", color: t.bad }, endLabel: { show: !narrow, distance: 14, formatter: (p: { value: number }) => `${fmt(p.value)} needed`, color: t.bad, fontWeight: 700, fontSize: 12 } }] : []),
    ],
  };

  const outcome = {
    ...baseOption(t),
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    tooltip: { ...t.tooltip, trigger: "item", formatter: (p: { seriesName: string; value: number }) => `${p.seriesName}: <b>${p.value}</b> (${pct(p.value / Math.max(1, m.att.length), 1)})` },
    xAxis: { type: "value", show: false, max: m.att.length || 1 },
    yAxis: { type: "category", show: false, data: ["Attempts"] },
    series: GROUPS.map((gname, k) => ({
      name: gname, type: "bar", stack: "a", barWidth: 38, data: [m.g.get(gname) ?? 0],
      itemStyle: { color: accentFor(DISP_COLOR[gname], t.dark), borderRadius: k === 0 ? [8, 0, 0, 8] : k === GROUPS.length - 1 ? [0, 8, 8, 0] : 0 },
      label: { show: (m.g.get(gname) ?? 0) / Math.max(1, m.att.length) > 0.06, color: t.dark ? "#0d0b1c" : "#fff", fontWeight: 700, formatter: () => pct((m.g.get(gname) ?? 0) / Math.max(1, m.att.length)) },
    })),
  };

  // by region
  const regions = [...groupBy(rows, (r) => r.region).entries()].map(([reg, rs]) => {
    const att = rs.filter((r) => r.disp !== "NOT_STARTED");
    const comp = rs.filter((r) => r.disp === "COMPLETE");
    const target = data.targets.byRegion[reg] ?? null;
    return {
      reg, rs, target, att: att.length, comp: comp.length, pct: target ? comp.length / target : null,
      nonContact: att.filter((r) => r.dispGroup === "Non-contact").length, refused: att.filter((r) => r.disp === "REFUSED").length,
      medDur: median(nums(comp, (r) => r.activeMin)), flags: comp.filter((r) => r.nCritical + r.nMajor > 0).length,
    };
  }).sort((a, b) => b.comp - a.comp || b.att - a.att);
  const maxComp = Math.max(1, ...regions.map((r) => r.comp));

  // teams
  const teamsChart = {
    ...baseOption(t),
    legend: { top: 0, right: 0, textStyle: { color: t.muted } },
    grid: { left: 44, right: 12, top: 34, bottom: 26 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "category", data: data.teams.map((x) => `Team ${x.team}`), ...axisStyle(t) },
    yAxis: { type: "value", ...axisStyle(t) },
    series: [
      { name: "Attempted", type: "bar", data: data.teams.map((x) => rows.filter((r) => r.team === x.team && r.disp !== "NOT_STARTED").length), itemStyle: { color: t.dark ? "#3a3270" : "#d6d2f2", borderRadius: [5, 5, 0, 0] }, barMaxWidth: 28 },
      { name: "Completed", type: "bar", data: data.teams.map((x) => rows.filter((r) => r.team === x.team && r.disp === "COMPLETE").length), itemStyle: { color: t.primary, borderRadius: [5, 5, 0, 0] }, barMaxWidth: 28, label: { show: true, position: "top", color: t.text, fontWeight: 700 } },
    ],
  };
  const teamTargets = data.teams.map((x) => ({ team: x.team, target: x.target, comp: rows.filter((r) => r.team === x.team && r.disp === "COMPLETE").length }));

  const modeChart = {
    ...baseOption(t),
    legend: { top: 0, right: 0, textStyle: { color: t.muted } },
    grid: { left: 64, right: 16, top: 34, bottom: 10 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", max: 100, ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: "{value}%" } },
    yAxis: { type: "category", inverse: true, data: data.teams.map((x) => `Team ${x.team}`), ...axisStyle(t) },
    series: ["1", "2", "3"].map((mo) => ({
      name: MODE_NAME[mo], type: "bar", stack: "m", barWidth: 18, itemStyle: { color: accentFor(MODE_COLOR[MODE_NAME[mo]], t.dark), borderRadius: 3 },
      data: data.teams.map((x) => {
        const s = rows.filter((r) => r.team === x.team && r.mode !== null);
        return s.length ? Math.round((s.filter((r) => String(r.mode) === mo).length / s.length) * 1000) / 10 : 0;
      }),
    })),
  };
  const modeCounts = countBy(rows.filter((r) => r.mode !== null), (r) => MODE_NAME[String(r.mode)]);

  // Sankey: review pipeline
  const submitted = rows.filter((r) => (r.status ?? 0) >= 100 || r.status === 65);
  const supApproved = submitted.filter((r) => [120, 125, 130].includes(r.status ?? 0)).length;
  const supRejected = submitted.filter((r) => r.status === 65).length;
  const supPending = submitted.filter((r) => r.status === 100).length;
  const hqApproved = submitted.filter((r) => r.status === 130).length;
  const hqRejected = submitted.filter((r) => r.status === 125).length;
  const hqPending = submitted.filter((r) => r.status === 120).length;
  const links = [
    { source: "Submitted by interviewers", target: "Awaiting supervisor", value: supPending },
    { source: "Submitted by interviewers", target: "Returned by supervisor", value: supRejected },
    { source: "Submitted by interviewers", target: "Approved by supervisor", value: supApproved },
    { source: "Approved by supervisor", target: "Awaiting HQ", value: hqPending },
    { source: "Approved by supervisor", target: "Returned by HQ", value: hqRejected },
    { source: "Approved by supervisor", target: "Approved by HQ (final)", value: hqApproved },
  ].filter((l) => l.value > 0);
  const nodeColor: Record<string, string> = {
    "Submitted by interviewers": t.primary, "Awaiting supervisor": "#2f6db5", "Returned by supervisor": "#b4436c",
    "Approved by supervisor": "#0e8a7e", "Awaiting HQ": "#c9a227", "Returned by HQ": "#d17a22", "Approved by HQ (final)": "#0f7a55",
  };
  const sankey = {
    ...baseOption(t),
    tooltip: { ...t.tooltip, trigger: "item" },
    series: [{
      type: "sankey", left: 8, right: 170, top: 10, bottom: 10, nodeWidth: 14, nodeGap: 16, draggable: false,
      data: [...new Set(links.flatMap((l) => [l.source, l.target]))].map((n) => ({ name: n, itemStyle: { color: nodeColor[n], borderWidth: 0 } })),
      links, lineStyle: { color: "gradient", opacity: 0.35, curveness: 0.5 },
      label: { color: t.text, fontSize: 12, fontWeight: 600, formatter: (p: { name: string; value: number }) => `${p.name}  ${p.value}` },
      emphasis: { focus: "adjacency" },
    }],
  };

  const lags = nums(rows, (r) => r.supLagH);
  const lagBins = [0, 6, 12, 24, 48, 72];
  const lagHist = lagBins.map((b, k) => lags.filter((x) => x >= b && (k === lagBins.length - 1 || x < lagBins[k + 1])).length);
  const lagChart = {
    ...baseOption(t),
    grid: { left: 36, right: 8, top: 10, bottom: 26 },
    tooltip: { ...t.tooltip, trigger: "axis" },
    xAxis: { type: "category", data: ["< 6 h", "6–12 h", "12–24 h", "24–48 h", "48–72 h", "72 h +"], ...axisStyle(t) },
    yAxis: { type: "value", minInterval: 1, ...axisStyle(t) },
    series: [{ type: "bar", data: lagHist.map((v, k) => ({ value: v, itemStyle: { color: k >= 4 ? t.bad : k === 3 ? "#d17a22" : t.primary, borderRadius: [5, 5, 0, 0] } })), barMaxWidth: 34 }],
  };

  const sec = [...countBy(m.comp, (r) => r.isicSection).entries()].sort((a, b) => b[1] - a[1]);
  const secChart = {
    ...baseOption(t),
    grid: { left: 190, right: 40, top: 4, bottom: 4 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: sec.map(([s]) => `${s} · ${data.isicSections[s]}`.slice(0, 30)), ...axisStyle(t), axisLine: { show: false } },
    series: [{ type: "bar", barWidth: 12, data: sec.map(([s, v]) => ({ value: v, itemStyle: { color: s === filters.section ? t.gold : "#0e8a7e", borderRadius: [0, 6, 6, 0] } })), label: { show: true, position: "right", color: t.text, fontWeight: 600 } }],
  };

  const callbacks = rows.filter((r) => r.disp === "CALLBACK" || r.disp === "LANGUAGE");
  const cbCols: Col<Rec>[] = [
    { key: "key", label: "Interview", value: (r) => r.key, render: (r) => <span className="font-mono text-xs">{r.key}</span> },
    { key: "est", label: "Establishment", value: (r) => r.estName ?? r.estId ?? "–" },
    { key: "int", label: "Interviewer", value: (r) => r.interviewer },
    { key: "region", label: "Region", value: (r) => titleCase(r.region) },
    { key: "disp", label: "Outcome", value: (r) => (r.disp === "CALLBACK" ? "Call-back requested" : "Language barrier") },
    { key: "when", label: "Agreed time", value: (r) => r.callback ?? "–" },
  ];

  const lagMed = median(lags);
  const lagP90 = quantile(lags, 0.9);

  return (
    <div className="space-y-6">
      <PageHeader title="Fieldwork progress" sub="How many establishments have been reached, where, by whom and how far each interview has moved through review." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label={m.target.label} value={m.target.value ? fmt(m.target.value) : "–"} accent="#6b7a90" sub="Establishments to interview" />
        <Kpi label="Attempted" value={fmt(m.att.length)} accent="#2f6db5" spark={m.da} sub={`${pct(m.target.value ? m.att.length / m.target.value : null, 1)} of target`} />
        <Kpi label="Completed" value={fmt(m.comp.length)} accent="#3c2fa3" spark={m.dc} sub={`${pct(m.target.value ? m.comp.length / m.target.value : null, 1)} of target`} />
        <Kpi label="Contact rate" value={pct(m.att.length ? m.contacted / m.att.length : null)} accent="#0e8a7e" sub="Reached ÷ attempted" hint="(complete + partial + refused + pending) ÷ attempted" />
        <Kpi label="Cooperation rate" value={pct(m.coopDen ? (m.g.get("Complete") ?? 0) / m.coopDen : null)} accent="#0f7a55" sub="Completes ÷ reached and eligible" />
      </div>

      <ChartCard title="Daily progress against the required pace" sub={m.target.value ? `Dashed red line = cumulative completes needed to finish ${fmt(m.target.value)} by ${shortDate(data.survey.fieldEnd)} (${fmt(m.target.value / Math.max(1, m.pace.total))} per fieldwork day).` : "Completes and attempts per day"}
        csv={() => m.days.map((d, k) => ({ date: d, attempted: m.da[k], completed: m.dc[k], cumulative: cumulative(m.dc)[k], required: Math.round(m.required[k]) }))} csvName="gaes-daily-progress">
        {m.days.length ? <EChart option={trend} height={320} /> : <Empty />}
      </ChartCard>

      <Card title="What happened to every attempt" sub={`${fmt(m.att.length)} establishments attempted — share by outcome`}>
        {m.att.length ? (
          <>
            <EChart option={outcome} height={44} />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {GROUPS.map((gname) => (
                <div key={gname} className="flex items-center gap-2.5">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: accentFor(DISP_COLOR[gname], t.dark) }} />
                  <div><div className="text-lg font-bold tabular-nums">{fmt(m.g.get(gname) ?? 0)}</div><div className="text-xs text-[var(--muted)]">{gname}</div></div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">Non-contact = no answer, unreachable/wrong number, switched off or call dropped. Pending = call-back or language barrier. The questionnaire has no result code, so outcomes are derived from the call-outcome questions.</p>
          </>
        ) : <Empty />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-5" id="calls">
        <CallAttemptsCard className="xl:col-span-3" />
        <VersionsCard className="xl:col-span-2" />
      </div>

      <Card title="Progress by region" sub={data.targets.regionSource === "uploaded" ? "Click a region to see its districts" : "Region targets not loaded — showing counts. Click a region to see its districts."} pad={false}
        csv={() => regions.map((r) => ({ region: r.reg, target: r.target, attempted: r.att, completed: r.comp, pct_of_target: r.pct, non_contact: r.nonContact, refused: r.refused, median_minutes: r.medDur, flagged: r.flags }))} csvName="gaes-progress-by-region">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Region</th><th className="text-right">Target</th><th className="text-right">Attempted</th><th className="text-right">Completed</th><th className="w-[22%]">Progress</th><th className="text-right">Non-contact</th><th className="text-right">Refused</th><th className="text-right">Median min</th><th className="text-right">Flagged</th></tr></thead>
            <tbody>
              {regions.map((r) => (
                <Fragment key={r.reg}>
                  <tr className="cursor-pointer" onClick={() => setOpenRegion(openRegion === r.reg ? null : r.reg)}>
                    <td className="font-semibold"><span className="inline-flex items-center gap-1.5"><ChevronRight size={14} className={`transition ${openRegion === r.reg ? "rotate-90" : ""}`} />{titleCase(r.reg)}</span></td>
                    <td className="text-right tabular-nums">{r.target ? fmt(r.target) : "–"}</td>
                    <td className="text-right tabular-nums">{fmt(r.att)}</td>
                    <td className="text-right font-semibold tabular-nums">{fmt(r.comp)}</td>
                    <td><div className="flex items-center gap-2"><InlineBar value={r.pct ?? r.comp} max={r.pct !== null ? 1 : maxComp} /><span className="w-12 text-right text-xs tabular-nums">{r.pct !== null ? pct(r.pct, 1) : ""}</span></div></td>
                    <td className="text-right tabular-nums">{fmt(r.nonContact)}</td>
                    <td className="text-right tabular-nums">{fmt(r.refused)}</td>
                    <td className="text-right tabular-nums">{fmt(r.medDur, 1)}</td>
                    <td className="text-right tabular-nums">{fmt(r.flags)}</td>
                  </tr>
                  {openRegion === r.reg && [...groupBy(r.rs, (x) => x.district).entries()].sort((a, b) => b[1].length - a[1].length).map(([d, ds]) => (
                    <tr key={d} className="bg-[var(--surface-2)] text-xs">
                      <td className="pl-10 text-[var(--muted)]">{titleCase(d)}</td>
                      <td />
                      <td className="text-right tabular-nums">{ds.filter((x) => x.disp !== "NOT_STARTED").length}</td>
                      <td className="text-right tabular-nums">{ds.filter((x) => x.disp === "COMPLETE").length}</td>
                      <td colSpan={5} />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!regions.length && <Empty />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Teams: attempted and completed" sub="Each team has about 2,000 assigned establishments"
          table={<table className="table table-compact"><thead><tr><th>Team</th><th className="text-right">Assigned</th><th className="text-right">Completed</th><th className="text-right">%</th></tr></thead><tbody>{teamTargets.map((x) => <tr key={x.team}><td>Team {x.team}</td><td className="text-right">{fmt(x.target)}</td><td className="text-right">{fmt(x.comp)}</td><td className="text-right">{pct(x.target ? x.comp / x.target : null, 1)}</td></tr>)}</tbody></table>}>
          <EChart option={teamsChart} height={280} onClick={(p) => { const n = (p as { name?: string }).name; if (n) setFilters({ ...filters, team: n.replace(/\D/g, "") }); }} />
        </ChartCard>
        <Card title="Interview mode by team" sub={`CATI is the default; face-to-face (CAPI) and Web only on request. Overall: ${[...modeCounts.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}`}>
          <EChart option={modeChart} height={280} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5" id="pipeline">
        <Card className="xl:col-span-3" title="Review pipeline" sub="Where submitted interviews are now: supervisor review, then HQ review. Returned interviews go back to the interviewer.">
          {links.length ? <EChart option={sankey} height={300} /> : <Empty title="Nothing submitted yet" sub="" />}
        </Card>
        <Card className="xl:col-span-2" title="How fast supervisors review" sub="Hours from completion to the supervisor's first decision">
          <div className="mb-2 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-2xl font-bold tabular-nums">{lagMed !== null ? `${fmt(lagMed, 1)} h` : "–"}</div><div className="text-xs text-[var(--muted)]">median decision time</div></div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-2xl font-bold tabular-nums">{lagP90 !== null ? `${fmt(lagP90, 1)} h` : "–"}</div><div className="text-xs text-[var(--muted)]">90% decided within</div></div>
          </div>
          {lags.length ? <EChart option={lagChart} height={190} /> : <Empty title="No reviews yet" sub="" />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Completed interviews by sector (ISIC Rev. 5 section)" sub="Click a bar to filter. Sector targets appear once the sample file is loaded.">
          {sec.length ? <EChart option={secChart} height={Math.max(200, sec.length * 26)} onClick={(p) => {
            const n = (p as { name?: string }).name; if (n) setFilters({ ...filters, section: filters.section === n[0] ? "" : n[0] });
          }} /> : <Empty />}
        </Card>
        <Card title={<span className="flex items-center gap-2"><PhoneCall size={16} /> Call-backs to keep</span>} sub="Respondents who asked to be called at another time, or needed another language" pad={false}
          csv={() => tableCsv(callbacks, cbCols)} csvName="gaes-callbacks">
          <DataTable rows={callbacks} cols={cbCols} rowKey={(r) => r.id} onRow={(r) => setSelected(r.id)} pageSize={8} compact
            empty={<Empty title="No pending call-backs" sub="" />} />
        </Card>
      </div>
    </div>
  );
}
