"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListChecks, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useData } from "@/components/data/DataProvider";
import { BandChip, Card, ChartCard, DataTable, Empty, Kpi, Loading, PageHeader, SevChip, tableCsv, type Col } from "@/components/ui/kit";
import EChart from "@/components/charts/EChart";
import { accentFor, axisStyle, baseOption, BAND_COLOR, SEV_COLOR, useChartTheme } from "@/components/ui/theme";
import { fmt, mean, nums, pct, titleCase } from "@/lib/fmt";
import type { CheckDef, Flag, InterviewerRow, ItemNR, Rec } from "@/lib/data/types";

const SEVS = ["critical", "major", "minor", "info"] as const;
const MODE: Record<number, string> = { 1: "CATI", 2: "CAPI", 3: "Web" };
const BANDS = ["Good", "Review", "Poor", "Reject"];

export default function QualityPage() {
  return <Suspense fallback={<Loading />}><Quality /></Suspense>;
}

function Quality() {
  const { data, rows, setSelected, setAnswersId } = useData();
  const t = useChartTheme();
  const params = useSearchParams();
  const [check, setCheck] = useState<string | null>(null);
  const [sev, setSev] = useState<string>("");
  const [cat, setCat] = useState<string>("");
  useEffect(() => {
    const s = params.get("sev");
    if (s) setSev(s);
    const c = params.get("check");
    if (c) setCheck(c);
  }, [params]);

  const m = useMemo(() => {
    if (!data) return null;
    const ids = new Set(rows.map((r) => r.id));
    const flags = data.flags.filter((f) => f.iid && ids.has(f.iid));
    const comp = rows.filter((r) => r.disp === "COMPLETE");
    const scores = nums(comp, (r) => r.score);
    const bands = new Map(BANDS.map((b) => [b, comp.filter((r) => r.band === b).length]));
    const byCheck = new Map<string, Set<string>>();
    for (const f of flags) {
      let s = byCheck.get(f.check);
      if (!s) byCheck.set(f.check, (s = new Set()));
      s.add(f.iid);
    }
    const ibFlags = data.flags.filter((f) => !f.iid);
    for (const f of ibFlags) {
      let s = byCheck.get(f.check);
      if (!s) byCheck.set(f.check, (s = new Set()));
      s.add(f.interviewer ?? "");
    }
    return { flags, comp, scores, bands, byCheck, ibFlags, real: flags.filter((f) => f.sev !== "info") };
  }, [data, rows]);

  if (!data || !m) return <Loading />;

  const flagged = rows
    .filter((r) => r.nCritical + r.nMajor + r.nMinor > 0)
    .filter((r) => !sev || (sev === "critical" ? r.nCritical : sev === "major" ? r.nMajor : r.nMinor) > 0)
    .filter((r) => !check || m.byCheck.get(check)?.has(r.id))
    .filter((r) => !cat || m.flags.some((f) => f.iid === r.id && f.cat === cat && f.sev !== "info"));

  // histogram of scores
  const bins = Array.from({ length: 10 }, (_, k) => k * 10);
  const hist = bins.map((b) => m.scores.filter((s) => (b === 90 ? s >= 90 : s >= b && s < b + 10)).length);
  const bandOfBin = (b: number) => (b >= 80 ? "Good" : b >= 70 ? "Review" : b >= 50 ? "Poor" : "Reject");
  const histChart = {
    ...baseOption(t),
    grid: { left: 36, right: 8, top: 10, bottom: 26 },
    tooltip: { ...t.tooltip, trigger: "axis" },
    xAxis: { type: "category", data: bins.map((b) => (b === 90 ? "90–100" : `${b}–${b + 9}`)), ...axisStyle(t) },
    yAxis: { type: "value", minInterval: 1, ...axisStyle(t) },
    series: [{ type: "bar", barMaxWidth: 40, data: hist.map((v, k) => ({ value: v, itemStyle: { color: accentFor(BAND_COLOR[bins[k] >= 85 ? "Good" : bandOfBin(bins[k])], t.dark), borderRadius: [5, 5, 0, 0] } })) }],
  };

  const cats = [...new Set(m.real.map((f) => f.cat))];
  const catTotals = cats.map((c) => ({ c, n: m.real.filter((f) => f.cat === c).length })).sort((a, b) => b.n - a.n);
  const catChart = {
    ...baseOption(t),
    legend: { top: 0, right: 0, textStyle: { color: t.muted } },
    grid: { left: 130, right: 30, top: 30, bottom: 6 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", ...axisStyle(t) },
    yAxis: { type: "category", inverse: true, data: catTotals.map((x) => x.c), ...axisStyle(t), axisLine: { show: false } },
    series: (["critical", "major", "minor"] as const).map((s) => ({
      name: titleCase(s), type: "bar", stack: "s", barWidth: 16, itemStyle: { color: accentFor(SEV_COLOR[s], t.dark) },
      data: catTotals.map((x) => m.real.filter((f) => f.cat === x.c && f.sev === s).length),
    })),
  };

  const eligible = (c: CheckDef) => {
    if (c.cat === "Interviewer-behaviour") return ["DQ-IB-06", "DQ-IB-07", "DQ-IB-09", "DQ-IB-04"].includes(c.id) ? data.interviewers.length : data.interviewers.filter((i) => i.complete >= 5).length || null;
    if (c.id === "DQ-PR-07") return null;
    return c.scope.startsWith("Complete") ? m.comp.length : rows.length;
  };
  const checkRows = data.checks.map((c) => {
    const n = m.byCheck.get(c.id)?.size ?? 0;
    const sevs = (c.cat === "Interviewer-behaviour" ? m.ibFlags : m.flags).filter((f) => f.check === c.id);
    return { ...c, n, eligible: eligible(c), worst: SEVS.find((s) => sevs.some((f) => f.sev === s)) ?? (c.sev === "varies" ? "minor" : c.sev) };
  });
  const checkCols: Col<(typeof checkRows)[number]>[] = [
    { key: "id", label: "Check", value: (r) => r.id, render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "name", label: "What it looks for", value: (r) => r.name, render: (r) => <div><div className="font-semibold">{r.name}</div><div className="text-xs text-[var(--muted)]">{r.desc}</div></div> },
    { key: "cat", label: "Category", value: (r) => r.cat },
    { key: "sev", label: "Severity", value: (r) => SEVS.indexOf(r.worst as never), render: (r) => <SevChip sev={r.worst} /> },
    { key: "modes", label: "Modes", value: (r) => r.modes, render: (r) => <span className="text-xs">{r.modes}</span> },
    { key: "n", label: "Flagged", align: "right", value: (r) => r.n, render: (r) => <span className={r.n ? "font-bold" : "text-[var(--muted)]"}>{fmt(r.n)}</span> },
    { key: "p", label: "% eligible", align: "right", value: (r) => (r.eligible ? r.n / r.eligible : null), render: (r) => (r.eligible ? pct(r.n / r.eligible, 1) : "–") },
  ];

  const flaggedCols: Col<Rec>[] = [
    { key: "key", label: "Interview", value: (r) => r.key, render: (r) => <span className="whitespace-nowrap font-mono text-xs font-semibold">{r.key}</span> },
    { key: "ans", label: "Answers", csv: false, render: (r) => (
      <button className="btn btn-ghost btn-sm !px-2 !py-1 !text-xs" title="Browse every answer of this interview" aria-label={`View all answers of interview ${r.key}`}
        onClick={(e) => { e.stopPropagation(); setAnswersId(r.id); }}>
        <ListChecks size={13} /> View
      </button>) },
    { key: "est", label: "Establishment", value: (r) => r.estName ?? r.estId ?? "", render: (r) => <span className="line-clamp-1 block min-w-[140px] max-w-[220px]">{r.estName ?? r.estId ?? "–"}</span> },
    { key: "int", label: "Interviewer", value: (r) => r.interviewer },
    { key: "team", label: "Team", value: (r) => r.team, align: "center" },
    { key: "region", label: "Region", value: (r) => titleCase(r.region) },
    { key: "mode", label: "Mode", value: (r) => (r.mode ? MODE[r.mode] : "–") },
    { key: "score", label: "Score", align: "right", value: (r) => r.score },
    { key: "band", label: "Band", value: (r) => r.band, render: (r) => <BandChip band={r.band} /> },
    { key: "c", label: "Crit", align: "right", value: (r) => r.nCritical, render: (r) => <span className={r.nCritical ? "font-bold text-[var(--bad)]" : "text-[var(--muted)]"}>{r.nCritical}</span> },
    { key: "mj", label: "Major", align: "right", value: (r) => r.nMajor, render: (r) => <span className={r.nMajor ? "font-semibold text-[#d17a22]" : "text-[var(--muted)]"}>{r.nMajor}</span> },
    { key: "mn", label: "Minor", align: "right", value: (r) => r.nMinor },
    { key: "status", label: "Stage", value: (r) => data.stages.find((s) => s.key === r.stage)?.label ?? r.stage, render: (r) => <span className="text-xs">{data.stages.find((s) => s.key === r.stage)?.label}</span> },
    { key: "flags", label: "Issues", value: (r) => m.flags.filter((f) => f.iid === r.id && f.sev !== "info").map((f) => f.check).join(" "), csv: true,
      render: (r) => <span className="line-clamp-2 block min-w-[260px] max-w-[340px] text-xs text-[var(--muted)]">{m.flags.filter((f) => f.iid === r.id && f.sev !== "info").slice(0, 3).map((f) => data.checks.find((c) => c.id === f.check)?.name).join(" · ")}</span> },
  ];

  const iqi = [...data.interviewers].filter((i) => i.complete > 0);
  const iqiCols: Col<InterviewerRow>[] = [
    { key: "login", label: "Interviewer", value: (r) => r.login, render: (r) => <div><div className="font-semibold">{r.login}</div><div className="text-xs text-[var(--muted)]">{r.name}</div></div> },
    { key: "team", label: "Team", value: (r) => r.team, align: "center" },
    { key: "n", label: "Completes", value: (r) => r.complete, align: "right" },
    { key: "iqi", label: "Quality index", value: (r) => r.iqi, align: "right", render: (r) => r.iqi === null ? <span className="text-xs text-[var(--muted)]">needs 5+</span> : (
      <span className={`chip ${r.iqi >= 85 ? "chip-good" : r.iqi >= 70 ? "chip-warn" : "chip-bad"} ${r.complete < 15 ? "opacity-70" : ""}`}>{r.iqi}</span>) },
    { key: "score", label: "Mean score", value: (r) => r.meanScore, align: "right", render: (r) => fmt(r.meanScore, 0) },
    { key: "dur", label: "Median min", value: (r) => r.medDuration, align: "right", render: (r) => fmt(r.medDuration, 1) },
    { key: "heap", label: "Round 1000s", value: (r) => r.heapShare, align: "right", render: (r) => pct(r.heapShare) },
    { key: "zero", label: "Zero items", value: (r) => r.zeroShare, align: "right", render: (r) => pct(r.zeroShare) },
    { key: "rej", label: "Rejections", value: (r) => r.rejections, align: "right" },
    { key: "flags", label: "Behaviour flags", value: (r) => r.flags.filter((f) => f !== "DQ-IB-09").join(" "), render: (r) => <div className="flex flex-wrap gap-1">{r.flags.filter((f) => f !== "DQ-IB-09").map((f) => <span key={f} className="chip chip-accent font-mono !text-[10px]">{f.replace("DQ-", "")}</span>)}</div> },
  ];

  const inrRows = data.itemNR.filter((x) => x.missing > 0 || (x.zero ?? 0) > 0);
  const inrCols: Col<ItemNR>[] = [
    { key: "v", label: "Variable", value: (r) => r.variable, render: (r) => <span className="font-mono text-xs">{r.variable}</span> },
    { key: "l", label: "Question", value: (r) => r.label, render: (r) => <span className="line-clamp-2 max-w-[360px] text-xs">{r.label}</span> },
    { key: "m", label: "Module", value: (r) => r.module },
    { key: "e", label: "Asked", align: "right", value: (r) => r.enabled },
    { key: "mp", label: "Missing", align: "right", value: (r) => r.missing / r.enabled, render: (r) => <span className={r.missing / r.enabled > 0.1 ? "font-bold text-[var(--bad)]" : ""}>{pct(r.missing / r.enabled, 1)}</span> },
    { key: "z", label: "Zero", align: "right", value: (r) => (r.zero === null ? null : r.zero / r.enabled), render: (r) => (r.zero === null ? "–" : pct(r.zero / r.enabled)) },
  ];

  const excluded = data.excludedRecords ?? [];
  const meanScore = mean(m.scores);
  const crit = m.comp.filter((r) => r.nCritical > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Data quality" sub={`${data.checks.length} automated checks run on every interview at each refresh: identification, duplicates, completeness, timing, arithmetic, logical consistency, outliers, GPS, mode and process. Each completed interview gets a 0–100 quality score.`}
        right={<button className="btn btn-ghost" onClick={() => {
          const rowsCsv = m.flags.map((f: Flag) => ({ interview: f.key, check: f.check, name: data.checks.find((c) => c.id === f.check)?.name, severity: f.sev, category: f.cat, message: f.msg, interviewer: f.interviewer, team: f.team, region: f.region }));
          import("@/lib/fmt").then(({ toCSV, downloadText }) => downloadText("gaes-quality-flags.csv", toCSV(rowsCsv)));
        }}>Download all flags (CSV)</button>} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Mean quality score" value={fmt(meanScore, 1)} accent="#3c2fa3" sub={`${fmt(m.comp.length)} completed interviews`} />
        {BANDS.map((b) => (
          <Kpi key={b} label={b} value={fmt(m.bands.get(b) ?? 0)} accent={BAND_COLOR[b]} sub={pct(m.comp.length ? (m.bands.get(b) ?? 0) / m.comp.length : null)}
            hint={b === "Good" ? "Score 85+" : b === "Review" ? "Score 70–84" : b === "Poor" ? "Score 50–69" : "Score < 50 or any critical flag"} />
        ))}
        <Kpi label="Open flags" value={fmt(m.real.length)} accent="#d17a22" goodWhenUp={false} sub={`across ${fmt(rows.length)} interviews (${fmt(rows.length ? m.real.length / rows.length : 0, 1)} each) · ${fmt(crit)} completes with a critical flag`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Quality scores of completed interviews" sub="Green ≥ 85 good · gold 70–84 review · orange 50–69 poor · red < 50 or critical"
          csv={() => bins.map((b, k) => ({ score_from: b, interviews: hist[k] }))} csvName="gaes-score-distribution">
          {m.scores.length ? <EChart option={histChart} height={260} /> : <Empty />}
        </ChartCard>
        <Card title="Where the problems are" sub="Open flags by category and severity — click a bar to filter the list below">
          {catTotals.length ? <EChart option={catChart} height={Math.max(220, catTotals.length * 30 + 40)} onClick={(p) => { const n = (p as { name?: string }).name; if (n) setCat(cat === n ? "" : n); }} /> : <Empty title="No flags" sub="" />}
        </Card>
      </div>

      <Card id="flagged" pad={false}
        title={<span className="flex items-center gap-2"><ShieldAlert size={17} className="text-[var(--bad)]" /> Interviews to follow up ({fmt(flagged.length)})</span>}
        sub="Worst first. Click a row for a summary of its flags, or View to read every answer the interview gave."
        csv={() => tableCsv(flagged, flaggedCols)} csvName="gaes-flagged-interviews"
        actions={<div className="flex flex-wrap items-center gap-1.5">
          {(["critical", "major", "minor"] as const).map((s) => <button key={s} className={`pill capitalize ${sev === s ? "pill-on" : ""}`} onClick={() => setSev(sev === s ? "" : s)}>{s}</button>)}
          {check && <button className="chip chip-primary" onClick={() => setCheck(null)}>{check} <X size={12} /></button>}
          {cat && <button className="chip chip-primary" onClick={() => setCat("")}>{cat} <X size={12} /></button>}
        </div>}>
        <DataTable rows={flagged} cols={flaggedCols} rowKey={(r) => r.id} initialSort="c" onRow={(r) => setSelected(r.id)} pageSize={15}
          empty={<Empty title="No flagged interviews for this selection" sub="" />} />
      </Card>

      <Card title="All checks" sub="Click a check to list the interviews it flagged. Thresholds come from the documented rules and the first days of data (see docs/SPEC.md)." pad={false}
        csv={() => tableCsv(checkRows, checkCols)} csvName="gaes-check-summary">
        <DataTable rows={checkRows} cols={checkCols} rowKey={(r) => r.id} initialSort="n" pageSize={20}
          onRow={(r) => { if (r.cat !== "Interviewer-behaviour") { setCheck(r.id); setSev(""); setCat(""); document.getElementById("flagged")?.scrollIntoView({ behavior: "smooth" }); } }} />
      </Card>

      <Card title={<span className="flex items-center gap-2"><ShieldCheck size={17} /> Interviewer quality index</span>} sub="Weakest first. Index = 40% mean score + 15% critical-free + 15% pace + 10% rejections + 10% heaping + 10% zero-filling. Shown for interviewers with 5+ completes; productivity is deliberately not part of it." pad={false}
        csv={() => tableCsv(iqi, iqiCols)} csvName="gaes-interviewer-quality">
        <DataTable rows={iqi} cols={iqiCols} rowKey={(r) => r.login} initialSort="iqi" desc={false} pageSize={12} compact />
      </Card>

      {m.ibFlags.filter((f) => f.sev !== "info").length > 0 && (
        <Card title="Interviewer behaviour alerts" sub="Patterns across an interviewer's work (not counted in individual interview scores)">
          <ul className="space-y-2">
            {m.ibFlags.filter((f) => f.sev !== "info").map((f, k) => (
              <li key={k} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
                <SevChip sev={f.sev} />
                <div><span className="font-semibold">{data.checks.find((c) => c.id === f.check)?.name}</span> — <span className="text-[var(--muted)]">{f.msg}</span></div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Item non-response and zero answers" sub="Among completed interviews where the question was asked. There is no 'don't know' code, so a high zero rate on money items is the warning sign." pad={false}
          csv={() => tableCsv(inrRows, inrCols)} csvName="gaes-item-nonresponse">
          <DataTable rows={inrRows} cols={inrCols} rowKey={(r) => r.variable} initialSort="mp" pageSize={10} compact />
        </Card>
        <Card className="xl:col-span-2" title="Excluded records" sub="Test/training, out-of-window and duplicate interviews are removed from every count and chart." pad={false}>
          {excluded.length ? (
            <table className="table table-compact"><thead><tr><th>Interview</th><th>Interviewer</th><th>Reason</th></tr></thead>
              <tbody>{excluded.map((r) => <tr key={r.id} className="cursor-pointer" onClick={() => setSelected(r.id)}><td className="font-mono text-xs">{r.key}</td><td>{r.interviewer}</td><td className="text-xs">{r.excluded}</td></tr>)}</tbody></table>
          ) : <Empty title="No records excluded" sub="No test, out-of-window or duplicate interviews found." />}
        </Card>
      </div>
    </div>
  );
}
