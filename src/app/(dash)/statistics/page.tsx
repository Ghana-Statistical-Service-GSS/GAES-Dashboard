"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useData } from "@/components/data/DataProvider";
import { Card, ChartCard, Empty, Kpi, Loading, PageHeader } from "@/components/ui/kit";
import EChart from "@/components/charts/EChart";
import { axisStyle, baseOption, useChartTheme } from "@/components/ui/theme";
import { cedi, compact, countBy, fmt, groupBy, mean, median, nums, pct, quantile, sum, titleCase } from "@/lib/fmt";
import type { Rec } from "@/lib/data/types";
import { ISIC_SECTIONS } from "@/lib/data/config";

const SIZE = ["No workers", "Micro (1-5)", "Small (6-30)", "Medium (31-100)", "Large (101+)"];
const MIN_N = 5;
const LEGAL: Record<number, string> = { 1: "Sole proprietorship", 2: "Partnership", 3: "Private limited", 4: "Public limited", 5: "Cooperative", 96: "Other" };
const STATUS: Record<number, string> = { 1: "Active", 2: "Temporarily suspended", 3: "Ceased, pending dissolution", 4: "Dissolved / bankrupt" };
const REVCH: Record<number, string> = { 1: "Increased", 2: "Same", 3: "Decreased", 97: "First year" };
const CREDIT_SRC: Record<number, string> = { 1: "Commercial bank", 2: "Microfinance", 3: "Mobile money / fintech", 4: "Family or friends", 5: "Government scheme", 96: "Other" };
const OPEX_LBL = ["Labour", "Goods for resale", "Operating costs", "Professional services", "Financial costs", "Taxes"];

export default function StatisticsPage() {
  const { data, rows } = useData();
  const t = useChartTheme();
  const [unresolved, setUnresolved] = useState(false);
  const [recordsOnly, setRecordsOnly] = useState(false);
  const [size, setSize] = useState("");

  const base = useMemo(() => rows.filter((r) =>
    r.disp === "COMPLETE" && !r.excluded && ![65, 125].includes(r.status ?? 0) &&
    (unresolved || r.analysable) && (!recordsOnly || r.records === true) && (!size || r.sizeClass === size)
  ), [rows, unresolved, recordsOnly, size]);

  if (!data) return <Loading />;

  const emp = nums(base, (r) => r.emp25);
  const rev = nums(base, (r) => r.rev);
  const wpw = nums(base, (r) => r.wpw);
  const small = base.length < MIN_N;

  const hbar = (labels: string[], values: number[], color: string, fmtV = (v: number) => fmt(v), left = 150, right = 70) => ({
    ...baseOption(t),
    grid: { left, right, top: 4, bottom: 4 },
    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: labels, ...axisStyle(t), axisLine: { show: false }, axisLabel: { ...axisStyle(t).axisLabel, width: left - 12, overflow: "truncate" } },
    series: [{ type: "bar", barWidth: 13, data: values, itemStyle: { color, borderRadius: [0, 6, 6, 0] }, label: { show: true, position: "right", color: t.text, fontWeight: 600, formatter: (p: { value: number }) => fmtV(p.value) } }],
  });

  const secs = [...countBy(base, (r) => r.isicSection).entries()].sort((a, b) => b[1] - a[1]);
  const sizes = SIZE.map((s) => base.filter((r) => r.sizeClass === s).length);
  const sizeChart = {
    ...baseOption(t),
    grid: { left: 36, right: 8, top: 24, bottom: 28 },
    tooltip: { ...t.tooltip, trigger: "axis" },
    xAxis: { type: "category", data: SIZE.map((s) => s.replace(" (", "\n(")), ...axisStyle(t) },
    yAxis: { type: "value", minInterval: 1, ...axisStyle(t) },
    series: [{ type: "bar", barMaxWidth: 46, data: sizes.map((v, k) => ({ value: v, itemStyle: { color: t.seq[Math.min(6, k + 2)], borderRadius: [6, 6, 0, 0] } })), label: { show: true, position: "top", color: t.text, fontWeight: 700, formatter: (p: { value: number }) => `${p.value} · ${pct(p.value / Math.max(1, base.length))}` } }],
  };

  // workers composition
  const contract = [0, 1, 2].map((k) => sum(base.map((r) => r.contract[k])));
  const occ = [0, 1, 2, 3, 4].map((k) => sum(base.map((r) => r.occ[k])));
  const totalW = sum(emp);
  const female = sum(base.map((r) => r.female));
  const ssnit = sum(base.map((r) => r.ssnit));
  const stack100 = (cats: string[], values: number[], colors: string[]) => ({
    ...baseOption(t),
    legend: { bottom: 0, textStyle: { color: t.muted }, itemWidth: 12, itemHeight: 8 },
    grid: { left: 0, right: 0, top: 6, bottom: 36 },
    tooltip: { ...t.tooltip, trigger: "item", formatter: (p: { seriesName: string; value: number }) => `${p.seriesName}: <b>${fmt(p.value)}</b> (${pct(p.value / Math.max(1, sum(values)), 1)})` },
    xAxis: { type: "value", show: false, max: Math.max(1, sum(values)) },
    yAxis: { type: "category", show: false, data: ["x"] },
    series: cats.map((c, k) => ({
      name: c, type: "bar", stack: "s", barWidth: 30, data: [values[k]], itemStyle: { color: colors[k], borderRadius: k === 0 ? [6, 0, 0, 6] : k === cats.length - 1 ? [0, 6, 6, 0] : 0 },
      label: { show: values[k] / Math.max(1, sum(values)) > 0.08, color: "#fff", fontWeight: 700, formatter: () => pct(values[k] / Math.max(1, sum(values))) },
    })),
  });

  // revenue tables
  const revTable = (key: (r: Rec) => string | null, label: (k: string) => string) =>
    [...groupBy(base, key).entries()].map(([k, rs]) => {
      const v = nums(rs, (r) => r.rev);
      return { k: label(k), n: v.length, median: median(v), mean: mean(v), p25: quantile(v, 0.25), p75: quantile(v, 0.75), total: sum(v) };
    }).sort((a, b) => b.n - a.n);
  const byRegion = revTable((r) => r.region, (k) => titleCase(k));
  const bySection = revTable((r) => r.isicSection, (k) => `${k} · ${ISIC_SECTIONS.find((s) => s.letter === k)?.short ?? ""}`);

  const boxSecs = [...groupBy(base, (r) => r.isicSection).entries()].map(([k, rs]) => ({ k, v: nums(rs, (r) => r.rev).filter((x) => x > 0).sort((a, b) => a - b) })).filter((x) => x.v.length >= MIN_N);
  const revBox = {
    ...baseOption(t),
    grid: { left: 50, right: 16, top: 16, bottom: 30 },
    tooltip: { ...t.tooltip, trigger: "item", formatter: (p: { name: string; value: number[] }) => p.value?.length > 4 ? `<b>Section ${p.name}</b><br/>median ${cedi(p.value[3])}<br/>middle half ${cedi(p.value[2])} – ${cedi(p.value[4])}` : "" },
    xAxis: { type: "category", data: boxSecs.map((x) => x.k), ...axisStyle(t) },
    yAxis: { type: "log", ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, formatter: (v: number) => compact(v) } },
    series: [{
      type: "boxplot", itemStyle: { color: t.dark ? "#2a2648" : "#eeecfa", borderColor: t.primary, borderWidth: 1.5 },
      data: boxSecs.map((x) => [x.v[0], quantile(x.v, 0.25)!, median(x.v)!, quantile(x.v, 0.75)!, x.v[x.v.length - 1]]),
    }],
  };

  // costs
  const opexSum = OPEX_LBL.map((_, k) => sum(base.map((r) => r.opexParts[k])));
  const capex = sum(base.map((r) => r.capex));
  const assets = nums(base, (r) => r.assets);
  const liabs = nums(base, (r) => r.liab);

  // characteristics
  const share = (pred: (r: Rec) => boolean | null) => {
    const v = base.map(pred).filter((x) => x !== null);
    return v.length >= MIN_N ? v.filter(Boolean).length / v.length : null;
  };
  const dist = (get: (r: Rec) => number | null, labels: Record<number, string>) => {
    const c = countBy(base, (r) => get(r));
    const tot = sum([...c.values()]);
    return Object.entries(labels).map(([k, l]) => ({ l, v: c.get(k) ?? 0, p: tot ? (c.get(k) ?? 0) / tot : 0 })).filter((x) => x.v > 0);
  };
  const borrowers = base.filter((r) => r.credit === 1);
  const srcCounts = Object.entries(CREDIT_SRC).map(([k, l]) => ({ l, v: borrowers.filter((r) => r.creditSources.includes(Number(k))).length }));

  const Mini = ({ title, items }: { title: string; items: { l: string; v: number; p: number }[] }) => (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="space-y-1.5">
        {items.map((x) => (
          <div key={x.l} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 text-xs">
            <span className="truncate">{x.l}</span><span className="tabular-nums text-[var(--muted)]">{fmt(x.v)} · {pct(x.p)}</span>
            <div className="bar-track col-span-2 !h-1.5"><div className="bar-fill" style={{ width: `${x.p * 100}%`, background: "#0e8a7e" }} /></div>
          </div>
        ))}
        {!items.length && <span className="text-xs text-[var(--muted)]">–</span>}
      </div>
    </div>
  );

  const Supp = ({ n, v }: { n: number; v: string }) => <>{n < MIN_N ? <span className="text-[var(--muted)]" title="Fewer than 5 establishments — suppressed">–</span> : v}</>;

  return (
    <div className="space-y-6">
      <PageHeader title="Statistical outputs" sub="Preliminary descriptive statistics from completed interviews, for monitoring only." />

      <div className="notice notice-warn !items-start">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <b>Unweighted, preliminary. Based on {fmt(base.length)} completed interviews{unresolved ? "" : " that passed critical checks"}. Not for publication.</b>
          <div className="mt-0.5 text-xs">Sampling weights are not yet available, so figures describe the interviewed establishments only. Cells with fewer than {MIN_N} establishments are suppressed (–). Expense totals use operating expenses only — the questionnaire&apos;s own total adds opening and closing stock and is not used.</div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={unresolved} onChange={(e) => setUnresolved(e.target.checked)} className="accent-[var(--gss-primary)]" /> Include interviews with unresolved critical flags</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={recordsOnly} onChange={(e) => setRecordsOnly(e.target.checked)} className="accent-[var(--gss-primary)]" /> Only establishments that keep financial records</label>
        <label className="flex items-center gap-2">Size class
          <select className="input input-sm !w-auto" value={size} onChange={(e) => setSize(e.target.value)}><option value="">All</option>{SIZE.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
      </div>

      {small ? <Card><Empty title="Too few interviews for statistics" sub={`At least ${MIN_N} clean completed interviews are needed for this selection.`} /></Card> : <>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Establishments" value={fmt(base.length)} accent="#3c2fa3" sub="clean completed interviews" />
          <Kpi label="Workers (2025)" value={fmt(totalW)} accent="#0e8a7e" sub={`${pct(totalW ? female / totalW : null)} female`} />
          <Kpi label="Median workers" value={fmt(median(emp), 1)} accent="#2f6db5" sub={`mean ${fmt(mean(emp), 1)}`} />
          <Kpi label="Median revenue FY2025" value={cedi(median(rev))} accent="#d17a22" sub={`middle half ${cedi(quantile(rev, 0.25))}–${cedi(quantile(rev, 0.75))}`} />
          <Kpi label="Total revenue reported" value={cedi(sum(rev))} accent="#b4436c" sub="sum over interviewed establishments" />
          <Kpi label="Median annual wage / paid employee" value={cedi(median(wpw))} accent="#6b7a90" sub={`${fmt(wpw.length)} establishments with paid staff`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Establishments by sector" sub="ISIC Rev. 5 section (after any re-coding in module 2)"
            csv={() => secs.map(([s, v]) => ({ section: s, name: data.isicSections[s], establishments: v }))} csvName="gaes-by-sector">
            <EChart option={hbar(secs.map(([s]) => `${s} · ${data.isicSections[s] ?? ""}`), secs.map(([, v]) => v), t.primary, (v) => `${v} · ${pct(v / base.length)}`, 210)} height={Math.max(200, secs.length * 26)} />
          </ChartCard>
          <ChartCard title="Establishments by employment size" sub="Workers in 2025, including working owners"
            csv={() => SIZE.map((s, k) => ({ size_class: s, establishments: sizes[k] }))} csvName="gaes-by-size">
            <EChart option={sizeChart} height={280} />
          </ChartCard>
        </div>

        <Card title={`Who works in these establishments — ${fmt(totalW)} workers`} sub={`Female ${pct(totalW ? female / totalW : null, 1)} · covered by SSNIT ${pct(totalW ? ssnit / totalW : null, 1)}`}
          csv={() => [{ group: "Permanent", n: contract[0] }, { group: "Temporary", n: contract[1] }, { group: "Unpaid", n: contract[2] }, ...["Managers", "Professionals & technicians", "Clerical", "Production & service", "Elementary"].map((g, k) => ({ group: g, n: occ[k] }))]} csvName="gaes-workers">
          <div className="grid gap-6 lg:grid-cols-2">
            <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">By type of contract</div>
              <EChart option={stack100(["Permanent", "Temporary", "Unpaid"], contract, [t.palette[0], t.palette[1], t.palette[5]])} height={90} /></div>
            <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">By occupation</div>
              <EChart option={stack100(["Managers", "Professionals", "Clerical", "Production & service", "Elementary"], occ, [t.palette[0], t.palette[3], t.palette[1], t.palette[2], t.palette[5]])} height={90} /></div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Revenue by region" sub="Total revenue FY2025 per establishment (GH₵)" pad={false}
            csv={() => byRegion.map((r) => ({ region: r.k, n: r.n, median: r.n >= MIN_N ? r.median : null, mean: r.n >= MIN_N ? r.mean : null, p25: r.n >= MIN_N ? r.p25 : null, p75: r.n >= MIN_N ? r.p75 : null, total: r.n >= MIN_N ? r.total : null }))} csvName="gaes-revenue-by-region">
            <RevTable rows={byRegion} Supp={Supp} />
          </Card>
          <Card title="Revenue by sector" sub="Total revenue FY2025 per establishment (GH₵)" pad={false}
            csv={() => bySection.map((r) => ({ section: r.k, n: r.n, median: r.n >= MIN_N ? r.median : null, mean: r.n >= MIN_N ? r.mean : null, total: r.n >= MIN_N ? r.total : null }))} csvName="gaes-revenue-by-sector">
            <RevTable rows={bySection} Supp={Supp} />
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Revenue spread by sector" sub={`Log scale. Box = middle half, line = median. Sectors with ${MIN_N}+ establishments.`}>
            {boxSecs.length ? <EChart option={revBox} height={300} /> : <Empty title="Not enough interviews per sector yet" sub="" />}
          </Card>
          <Card title="What operating expenses are made of" sub={`Total operating expenses ${cedi(sum(opexSum))} · capital investment ${cedi(capex)} (shown separately)`}>
            <EChart option={hbar(OPEX_LBL, opexSum, "#d17a22", (v) => `${cedi(v)} · ${pct(v / Math.max(1, sum(opexSum)))}`, 150, 130)} height={250} />
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Median total assets" value={cedi(median(assets))} accent="#3c2fa3" sub={`mean ${cedi(mean(assets))}`} />
          <Kpi label="Median total liabilities" value={cedi(median(liabs))} accent="#b4436c" sub={`${pct(liabs.length ? liabs.filter((x) => x > 0).length / liabs.length : null)} have any liabilities`} />
          <Kpi label="Received credit in 2025" value={pct(share((r) => (r.credit === null ? null : r.credit === 1)))} accent="#0e8a7e" sub={`${fmt(borrowers.length)} establishments`} />
          <Kpi label="Median capacity used" value={`${fmt(median(nums(base, (r) => r.capacity)))}%`} accent="#d17a22" sub="of full production capacity" />
        </div>

        <Card title="Establishment characteristics" sub="Share of interviewed establishments">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <Mini title="Legal form" items={dist((r) => r.legalForm, LEGAL)} />
            <Mini title="Operational status" items={dist((r) => r.opStatus, STATUS)} />
            <Mini title="Revenue compared with 2024" items={dist((r) => r.revChange, REVCH)} />
            <Mini title="Source of credit (borrowers)" items={srcCounts.map((x) => ({ ...x, p: borrowers.length ? x.v / borrowers.length : 0 })).filter((x) => x.v > 0)} />
            <Mini title="Key indicators" items={[
              { l: "Registered with Registrar-General", p: share((r) => (r.registered === null ? null : r.registered === 1)) ?? 0, v: base.filter((r) => r.registered === 1).length },
              { l: "Keeps financial records", p: share((r) => r.records) ?? 0, v: base.filter((r) => r.records).length },
              { l: "Female-owned (50%+)", p: share((r) => (r.femaleOwn === null ? null : r.femaleOwn >= 50)) ?? 0, v: base.filter((r) => (r.femaleOwn ?? 0) >= 50).length },
              { l: "Exports directly", p: share((r) => (r.exporter === null ? null : r.exporter === 1)) ?? 0, v: base.filter((r) => r.exporter === 1).length },
              { l: "Imports directly", p: share((r) => (r.importer === null ? null : r.importer === 1)) ?? 0, v: base.filter((r) => r.importer === 1).length },
            ]} />
          </div>
        </Card>
      </>}
    </div>
  );
}

function RevTable({ rows, Supp }: { rows: { k: string; n: number; median: number | null; mean: number | null; p25: number | null; p75: number | null; total: number }[]; Supp: (p: { n: number; v: string }) => React.ReactNode }) {
  return (
    <div className="max-h-[380px] overflow-auto">
      <table className="table table-compact">
        <thead><tr><th>Group</th><th className="text-right">n</th><th className="text-right">Median</th><th className="text-right">Mean</th><th className="text-right">25th–75th pct</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="max-w-[150px] truncate" title={r.k}>{r.k}</td>
              <td className="text-right tabular-nums">{r.n}</td>
              <td className="text-right tabular-nums"><Supp n={r.n} v={cedi(r.median)} /></td>
              <td className="text-right tabular-nums"><Supp n={r.n} v={cedi(r.mean)} /></td>
              <td className="text-right tabular-nums"><Supp n={r.n} v={`${compact(r.p25)}–${compact(r.p75)}`} /></td>
              <td className="text-right tabular-nums"><Supp n={r.n} v={cedi(r.total)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
