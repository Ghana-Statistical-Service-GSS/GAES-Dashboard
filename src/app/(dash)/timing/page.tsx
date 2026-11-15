"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/data/DataProvider";
import { Card, ChartCard, DataTable, Empty, Kpi, Loading, PageHeader, SevChip, tableCsv, type Col } from "@/components/ui/kit";
import EChart, { echarts } from "@/components/charts/EChart";
import { axisStyle, baseOption, useChartTheme } from "@/components/ui/theme";
import { fmt, groupBy, median, nums, pct, quantile } from "@/lib/fmt";
import type { Flag, QuestionTiming } from "@/lib/data/types";

const MODULES: Record<string, string> = { cover: "Cover", m0: "0 Call", m1: "1 Identification", m2: "2 Activities", m3: "3 Employment", m4: "4 Expenses", m5: "5 Revenue", m6: "6 Assets & credit" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TimingPage() {
  const { data, rows, setSelected } = useData();
  const t = useChartTheme();
  const [who, setWho] = useState("");
  const [day, setDay] = useState("");

  const m = useMemo(() => {
    if (!data) return null;
    const comp = rows.filter((r) => r.disp === "COMPLETE" && r.activeMin !== null && (r.mode === 1 || r.mode === 2));
    const durs = nums(comp, (r) => r.activeMin);
    const starts = rows.filter((r) => r.startHour !== null && r.mode === 1);
    const ids = new Set(rows.map((r) => r.id));
    const flags = data.flags.filter((f) => f.iid && ids.has(f.iid) && f.cat === "Timing" && f.sev !== "info");
    return { comp, durs, starts, flags };
  }, [data, rows]);

  if (!data || !m) return <Loading />;
  const med = median(m.durs);

  // histogram, 5-minute bins up to 150
  const binW = 5;
  const maxBin = 150;
  const bins = Array.from({ length: maxBin / binW + 1 }, (_, k) => k * binW);
  const hist = bins.map((b, k) => m.durs.filter((d) => (k === bins.length - 1 ? d >= b : d >= b && d < b + binW)).length);
  const histChart = {
    ...baseOption(t),
    grid: { left: 36, right: 12, top: 42, bottom: 30 },
    tooltip: { ...t.tooltip, trigger: "axis" },
    xAxis: { type: "category", data: bins.map((b, k) => (k === bins.length - 1 ? `${b}+` : `${b}`)), name: "minutes", nameLocation: "middle", nameGap: 22, nameTextStyle: { color: t.muted }, ...axisStyle(t) },
    yAxis: { type: "value", minInterval: 1, ...axisStyle(t) },
    series: [{
      type: "bar", barCategoryGap: "8%",
      data: hist.map((v, k) => ({ value: v, itemStyle: { color: bins[k] < 10 ? t.bad : bins[k] < 15 ? "#d17a22" : bins[k] >= 120 ? "#c9a227" : t.primary, borderRadius: [4, 4, 0, 0] } })),
      markLine: {
        symbol: "none", silent: true, label: { color: t.muted, fontSize: 11, formatter: "{b}" },
        data: [
          { xAxis: "10", name: "<10", lineStyle: { color: t.bad, type: "dashed" }, label: { position: "end", formatter: "10" } },
          { xAxis: "15", name: "15", lineStyle: { color: "#d17a22", type: "dashed" }, label: { position: "end", formatter: "15", distance: 17 } },
          { xAxis: "30", name: "design 30", lineStyle: { color: t.good, type: "solid", width: 2 }, label: { position: "end", formatter: "design 30", color: t.good, fontWeight: 600 } },
          { xAxis: "120", name: "120", lineStyle: { color: "#c9a227", type: "dashed" }, label: { position: "end", formatter: "120" } },
        ],
      },
    }],
  };

  // by interviewer box plot
  const byInt = [...groupBy(m.comp, (r) => r.interviewer).entries()]
    .map(([k, rs]) => ({ k, d: nums(rs, (r) => r.activeMin).sort((a, b) => a - b) }))
    .filter((x) => x.d.length > 0)
    .sort((a, b) => (median(a.d) ?? 0) - (median(b.d) ?? 0));
  const box = {
    ...baseOption(t),
    grid: { left: 60, right: 16, top: 26, bottom: 30 },
    tooltip: { ...t.tooltip, trigger: "item" },
    xAxis: { type: "value", name: "active minutes", nameLocation: "middle", nameGap: 22, nameTextStyle: { color: t.muted }, ...axisStyle(t) },
    yAxis: { type: "category", data: byInt.map((x) => x.k), ...axisStyle(t) },
    series: [
      {
        name: "Duration", type: "boxplot", boxWidth: [6, 14],
        itemStyle: { color: t.dark ? "#2a2648" : "#eeecfa", borderColor: t.primary, borderWidth: 1.5 },
        data: byInt.map((x) => x.d.length >= 5 ? [x.d[0], quantile(x.d, 0.25)!, median(x.d)!, quantile(x.d, 0.75)!, x.d[x.d.length - 1]] : [null, null, null, null, null]),
        tooltip: { formatter: (p: { name: string; value: (number | null)[] }) => p.value?.[3] != null ? `<b>${p.name}</b><br/>min ${fmt(p.value[1], 1)} · median ${fmt(p.value[3], 1)} · max ${fmt(p.value[5], 1)}` : `<b>${p.name}</b>` },
      },
      {
        name: "Interviews", type: "scatter", symbolSize: 7, itemStyle: { color: t.gold, borderColor: t.surface, borderWidth: 1 },
        data: byInt.flatMap((x) => x.d.map((d) => [d, x.k])),
        tooltip: { formatter: (p: { value: [number, string] }) => `${p.value[1]}: ${fmt(p.value[0], 1)} min` },
      },
    ],
  };
  if (med !== null) (box.series[0] as Record<string, unknown>).markLine = { symbol: "none", silent: true, data: [{ xAxis: med, name: "overall median" }], lineStyle: { color: t.bad, type: "dashed" }, label: { formatter: `median ${fmt(med, 0)}`, color: t.muted } };

  // heat map hour × weekday
  const heat: [number, number, number][] = [];
  for (let wd = 0; wd < 7; wd++) for (let h = 6; h <= 22; h++) {
    const jsWd = (wd + 1) % 7;
    heat.push([h - 6, wd, m.starts.filter((r) => r.startHour === h && r.weekday === jsWd).length]);
  }
  const heatMax = Math.max(1, ...heat.map((x) => x[2]));
  const heatChart = {
    ...baseOption(t),
    grid: { left: 40, right: 12, top: 10, bottom: 50 },
    tooltip: { ...t.tooltip, formatter: (p: { value: [number, number, number] }) => `${DAYS[p.value[1]]} ${p.value[0] + 6}:00–${p.value[0] + 7}:00<br/><b>${p.value[2]}</b> calls started` },
    xAxis: { type: "category", data: Array.from({ length: 17 }, (_, k) => `${k + 6}`), ...axisStyle(t), splitArea: { show: false } },
    yAxis: { type: "category", data: DAYS, inverse: true, ...axisStyle(t) },
    visualMap: { min: 0, max: heatMax, orient: "horizontal", left: "center", bottom: 0, itemHeight: 120, itemWidth: 10, textStyle: { color: t.muted }, inRange: { color: t.seq } },
    series: [{
      type: "heatmap", itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
      data: heat.map((v) => ({ value: v, label: { color: v[2] / heatMax > 0.5 ? "#ffffff" : t.text } })),
      label: { show: true, fontSize: 10, fontWeight: 600, formatter: (p: { value: number[] }) => (p.value[2] ? String(p.value[2]) : "") },
    }],
  };

  // recorded vs active
  const sc = m.comp.filter((r) => r.timespent !== null && r.timespent > 0);
  const scatter = {
    ...baseOption(t),
    grid: { left: 50, right: 20, top: 16, bottom: 40 },
    tooltip: { ...t.tooltip, formatter: (p: { data: { value: number[]; name: string } }) => `<b>${p.data.name}</b><br/>Recorded ${fmt(p.data.value[0])} min · active ${fmt(p.data.value[1], 1)} min` },
    xAxis: { type: "log", name: "recorded (timespent, min, log)", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: t.muted }, ...axisStyle(t) },
    yAxis: { type: "value", name: "active min", nameTextStyle: { color: t.muted }, ...axisStyle(t) },
    series: [
      { type: "scatter", symbolSize: 9, data: sc.map((r) => ({ name: r.key, value: [r.timespent, r.activeMin], id: r.id })), itemStyle: { color: t.primary, opacity: 0.75 } },
      { type: "line", symbol: "none", data: [[1, 1], [200, 200]], lineStyle: { color: t.muted, type: "dashed", width: 1 }, silent: true, tooltip: { show: false } },
    ],
  };

  // module time
  const mods = Object.keys(MODULES).filter((k) => k !== "cover");
  const modMed = mods.map((k) => median(nums(m.comp, (r) => r.moduleMin[k] ?? null)) ?? 0);
  const modChart = {
    ...baseOption(t),
    grid: { left: 130, right: 50, top: 6, bottom: 6 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${fmt(v, 1)} min` },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: mods.map((k) => MODULES[k]), ...axisStyle(t), axisLine: { show: false } },
    series: [{ type: "bar", barWidth: 14, data: modMed.map((v) => ({ value: Math.round(v * 10) / 10 })), itemStyle: { color: "#0e8a7e", borderRadius: [0, 6, 6, 0] }, label: { show: true, position: "right", color: t.text, formatter: (p: { value: number }) => `${fmt(p.value, 1)} min` } }],
  };

  // Gantt
  const interviewers = [...new Set(rows.filter((r) => r.sessions.length).map((r) => r.interviewer).filter(Boolean))].sort() as string[];
  const selWho = who || interviewers[0] || "";
  const theirs = rows.filter((r) => r.interviewer === selWho && r.sessions.length);
  const dates = [...new Set(theirs.flatMap((r) => r.sessions.map((s) => new Date(s[0]).toISOString().slice(0, 10))))].sort();
  const selDay = day && dates.includes(day) ? day : dates[dates.length - 1] ?? "";
  const dayRows = theirs.filter((r) => r.sessions.some((s) => new Date(s[0]).toISOString().slice(0, 10) === selDay));
  const ganttData = dayRows.flatMap((r, k) => r.sessions.filter((s) => new Date(s[0]).toISOString().slice(0, 10) === selDay).map((s) => ({ value: [k, s[0], s[1], s[2]], itemStyle: { color: r.disp === "COMPLETE" ? t.primary : "#b4436c" }, name: r.key })));
  const gantt = {
    ...baseOption(t),
    grid: { left: 96, right: 16, top: 10, bottom: 30 },
    tooltip: { ...t.tooltip, formatter: (p: { name: string; value: number[] }) => `<b>${p.name}</b><br/>${new Date(p.value[1]).toISOString().slice(11, 16)}–${new Date(p.value[2]).toISOString().slice(11, 16)} · ${p.value[3]} answers` },
    xAxis: { type: "time", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => new Date(v).toISOString().slice(11, 16) } },
    yAxis: { type: "category", data: dayRows.map((r) => r.key), inverse: true, ...axisStyle(t) },
    series: [{
      type: "custom", data: ganttData, encode: { x: [1, 2], y: 0 },
      renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[]; style: () => Record<string, unknown> }) => {
        const y = api.value(0);
        const a = api.coord([api.value(1), y]);
        const b = api.coord([api.value(2), y]);
        const h = api.size([0, 1])[1] * 0.55;
        const rect = echarts.graphic.clipRectByRect({ x: a[0], y: a[1] - h / 2, width: Math.max(3, b[0] - a[0]), height: h }, { x: 96, y: 0, width: 10000, height: 10000 });
        return rect && { type: "rect", shape: { ...rect, r: 4 }, style: api.style() };
      },
    }],
  };

  const qCols: Col<QuestionTiming>[] = [
    { key: "v", label: "Variable", value: (r) => r.variable, render: (r) => <span className="font-mono text-xs">{r.variable}</span> },
    { key: "l", label: "Question", value: (r) => r.label, render: (r) => <span className="line-clamp-2 block min-w-[220px] max-w-[420px] text-xs">{r.label}</span> },
    { key: "m", label: "Module", value: (r) => MODULES[r.module] ?? r.module },
    { key: "n", label: "Answers", align: "right", value: (r) => r.n },
    { key: "med", label: "Median s", align: "right", value: (r) => r.medianSec, render: (r) => fmt(r.medianSec, 1) },
    { key: "p90", label: "90th pct s", align: "right", value: (r) => r.p90Sec, render: (r) => fmt(r.p90Sec, 0) },
  ];
  const fCols: Col<Flag>[] = [
    { key: "k", label: "Interview", value: (r) => r.key, render: (r) => <span className="font-mono text-xs">{r.key}</span> },
    { key: "c", label: "Check", value: (r) => data.checks.find((c) => c.id === r.check)?.name ?? r.check },
    { key: "s", label: "Severity", value: (r) => r.sev, render: (r) => <SevChip sev={r.sev} /> },
    { key: "i", label: "Interviewer", value: (r) => r.interviewer },
    { key: "m", label: "Detail", value: (r) => r.msg, render: (r) => <span className="text-xs text-[var(--muted)]">{r.msg}</span> },
  ];

  const outside = m.starts.filter((r) => r.startHour! < 7 || r.startHour! >= 19).length;
  const gaps = nums(m.comp, (r) => r.medGapSec);

  return (
    <div className="space-y-6">
      <PageHeader title="Timing & paradata" sub="Interview length is measured from Survey Solutions paradata (every answer's timestamp), counting only active work — idle gaps over 5 minutes are capped. The recorded 'timespent' is wall-clock time and is shown only for comparison." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Median active length" value={<>{fmt(med, 1)}<span className="text-base text-[var(--muted)]"> min</span></>} accent="#3c2fa3" sub={`${fmt(m.durs.length)} completed CATI/CAPI interviews · design ≈ 30`} />
        <Kpi label="Under 15 minutes" value={pct(m.durs.length ? m.durs.filter((d) => d < 15).length / m.durs.length : null, 1)} accent="#b43c2a" goodWhenUp={false} sub={`${m.durs.filter((d) => d < 10).length} under 10 min (critical)`} />
        <Kpi label="Over 120 minutes" value={pct(m.durs.length ? m.durs.filter((d) => d > 120).length / m.durs.length : null, 1)} accent="#c9a227" sub="Very long — review for interruptions" />
        <Kpi label="Calls outside 07:00–19:00" value={pct(m.starts.length ? outside / m.starts.length : null, 1)} accent="#d17a22" sub={`${outside} of ${m.starts.length} CATI starts · rule is 08:00–17:00; flagged with 1 h tolerance`} />
        <Kpi label="Median time per answer" value={<>{fmt(median(gaps), 1)}<span className="text-base text-[var(--muted)]"> s</span></>} accent="#0e8a7e" sub="Below 3 s suggests reading too fast" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="How long interviews take" sub="Active minutes per completed interview. Red < 10 (impossible), orange 10–15 (very short), gold > 120."
          csv={() => m.comp.map((r) => ({ interview: r.key, interviewer: r.interviewer, active_min: r.activeMin, recorded_min: r.timespent, sessions: r.nSessions, median_gap_s: r.medGapSec }))} csvName="gaes-durations">
          {m.durs.length ? <EChart option={histChart} height={300} /> : <Empty />}
        </ChartCard>
        <Card title="Interview length by interviewer" sub="Gold dots are single interviews; boxes show the middle half (5+ interviews). Fastest interviewers at the top.">
          {byInt.length ? <EChart option={box} height={Math.max(260, byInt.length * 22 + 50)} /> : <Empty />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="When calls start" sub="CATI interview starts by weekday and hour (GMT). Agreed calling hours are Monday–Friday 08:00–17:00 unless the respondent asks otherwise.">
          {m.starts.length ? <EChart option={heatChart} height={320} /> : <Empty />}
        </Card>
        <Card title="Recorded vs active time" sub="Points far right of the dashed line were paused and finished later, or had their start time re-stamped. Click a point to open it.">
          {sc.length ? <EChart option={scatter} height={320} onClick={(p) => { const id = (p as { data?: { id?: string } }).data?.id; if (id) setSelected(id); }} /> : <Empty />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Where the time goes" sub="Median minutes per module (completed interviews)">
          {m.comp.length ? <EChart option={modChart} height={260} /> : <Empty />}
        </Card>
        <Card className="xl:col-span-3" title="Interviewer day timeline" sub="Each bar is a working session in Survey Solutions (purple = completed interview, rose = non-interview). Overlapping bars mean two interviews open at once."
          actions={<div className="flex max-w-full flex-wrap gap-2">
            <select aria-label="Interviewer" className="input input-sm !w-auto max-w-[210px]" value={selWho} onChange={(e) => { setWho(e.target.value); setDay(""); }}>{interviewers.map((i) => <option key={i} value={i}>{i}{data.interviewerNames[i] ? ` · ${data.interviewerNames[i]}` : ""}</option>)}</select>
            <select aria-label="Day" className="input input-sm !w-auto" value={selDay} onChange={(e) => setDay(e.target.value)}>{dates.map((d) => <option key={d}>{d}</option>)}</select>
          </div>}>
          {ganttData.length ? <EChart option={gantt} height={Math.max(200, dayRows.length * 30 + 50)} onClick={(p) => { const k = (p as { value?: number[] }).value?.[0]; if (k !== undefined && dayRows[k]) setSelected(dayRows[k].id); }} /> : <Empty title="No sessions" sub="Pick another interviewer or day." />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Slowest questions" sub="Median seconds before each answer — long times can point to unclear wording or records look-ups" pad={false}
          csv={() => tableCsv(data.questions, qCols)} csvName="gaes-question-timing">
          <DataTable rows={data.questions} cols={qCols} rowKey={(r) => r.variable} initialSort="med" pageSize={10} compact />
        </Card>
        <Card title="Timing flags" sub="Short, fast, night-time, re-stamped, overlapping and rapid-succession interviews" pad={false}
          csv={() => tableCsv(m.flags, fCols)} csvName="gaes-timing-flags">
          <DataTable rows={m.flags} cols={fCols} rowKey={(r) => r.iid + r.check} onRow={(r) => setSelected(r.iid)} pageSize={10} compact
            empty={<Empty title="No timing flags" sub="" />} />
        </Card>
      </div>
    </div>
  );
}
