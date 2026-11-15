"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Download, Info, Table2, BarChart2, SearchX } from "lucide-react";
import EChart from "@/components/charts/EChart";
import { accentFor, useChartTheme } from "./theme";
import { downloadText, toCSV } from "@/lib/fmt";

/** May this user download tables as CSV? Viewer accounts may not (set by the DataProvider). */
export const CanExportCtx = createContext(true);

/* ---------------- Card ---------------- */
export function Card({
  title, sub, actions, children, className = "", pad = true, csv, csvName, id,
}: {
  title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string;
  pad?: boolean; csv?: () => Record<string, unknown>[]; csvName?: string; id?: string;
}) {
  if (!useContext(CanExportCtx)) csv = undefined;
  return (
    <section id={id} className={`card fade-up ${className}`}>
      {(title || actions || csv) && (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-[18px]">
          <div className="min-w-0 flex-1 basis-[200px]">
            {title && <h3 className="text-[15px] font-bold leading-snug tracking-[-0.01em]">{title}</h3>}
            {sub && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{sub}</p>}
          </div>
          <div className="flex max-w-full items-center gap-1">
            {actions}
            {csv && (
              <button className="icon-btn" title="Download as CSV" onClick={() => downloadText(`${csvName ?? "gaes-data"}.csv`, toCSV(csv()))}>
                <Download size={15} />
              </button>
            )}
          </div>
        </header>
      )}
      <div className={pad ? "p-5 pt-3" : ""}>{children}</div>
    </section>
  );
}

/** Card with a chart / table toggle ("view data") */
export function ChartCard({
  title, sub, children, table, csv, csvName, className, actions,
}: {
  title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; table?: React.ReactNode;
  csv?: () => Record<string, unknown>[]; csvName?: string; className?: string; actions?: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card
      title={title} sub={sub} className={className} csv={csv} csvName={csvName}
      actions={<>
        {actions}
        {table && (
          <button className="icon-btn" title={showTable ? "Show chart" : "View data"} onClick={() => setShowTable(!showTable)}>
            {showTable ? <BarChart2 size={15} /> : <Table2 size={15} />}
          </button>
        )}
      </>}
    >
      {showTable && table ? <div className="max-h-[360px] overflow-auto">{table}</div> : children}
    </Card>
  );
}

/* ---------------- Animated number ---------------- */
export function CountUp({ value, format = (x: number) => Math.round(x).toLocaleString("en-GB"), ms = 750 }: { value: number; format?: (x: number) => string; ms?: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{format(v)}</>;
}

/* ---------------- KPI tile ---------------- */
export function Kpi({
  label, value, sub, accent, spark, delta, goodWhenUp = true, hint, icon, onClick,
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string; spark?: number[];
  delta?: number | null; goodWhenUp?: boolean; hint?: string; icon?: React.ReactNode; onClick?: () => void;
}) {
  const t = useChartTheme();
  const col = accentFor(accent ?? "#3c2fa3", t.dark);
  const opt = useMemo(() => spark && spark.length > 1 ? {
    animation: false,
    grid: { left: 2, right: 5, top: 6, bottom: 3 },
    xAxis: { type: "category", show: false, boundaryGap: false, data: spark.map((_, i) => i) },
    yAxis: { type: "value", show: false, min: 0 },
    series: [{
      type: "line", data: spark, smooth: 0.35, symbol: "none",
      lineStyle: { width: 2, color: col, cap: "round" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: col + "47" }, { offset: 1, color: col + "00" }] } },
      markPoint: { symbol: "circle", symbolSize: 7, data: [{ coord: [spark.length - 1, spark[spark.length - 1]] }], itemStyle: { color: col, borderColor: t.surface, borderWidth: 2 }, label: { show: false } },
    }],
  } : null, [spark, col, t.surface]);
  const up = (delta ?? 0) > 0;
  const good = delta === null || delta === undefined || delta === 0 ? null : up === goodWhenUp;
  return (
    <div
      className={`card kpi fade-up ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""}`} style={{ ["--kpi-accent" as string]: col }} title={hint}
      onClick={onClick} role={onClick ? "link" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      <div className="l flex min-w-0 items-center gap-2">
        {icon ? <span className="kpi-ico">{icon}</span> : <span className="kpi-bar" />}
        <span className="min-w-0">{label}{hint && <Info size={12} className="ml-1 inline-block align-[-1px] opacity-60" aria-label={hint} />}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <div className="v tabular-nums">{value}</div>
          {delta !== null && delta !== undefined && delta !== 0 && (
            <span className={`chip ${good ? "chip-good" : "chip-bad"} !px-1.5 !text-[11px]`} title="Change against the previous fieldwork day">
              {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(delta).toLocaleString("en-GB", { maximumFractionDigits: 1 })}
              <span className="sr-only"> against the previous fieldwork day</span>
            </span>
          )}
        </div>
        {opt && <div className="hidden h-10 w-24 shrink-0 min-[420px]:block" aria-hidden><EChart option={opt} height={40} /></div>}
      </div>
      {sub && <div className="d">{sub}</div>}
    </div>
  );
}

/* ---------------- Progress ring (SVG) ---------------- */
export function ProgressRing({
  value, time, size = 190, stroke = 14, children,
}: { value: number; time?: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2 - 8;
  const c = 2 * Math.PI * r;
  const r2 = r + stroke / 2 + 6;
  const c2 = 2 * Math.PI * r2;
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnim(1));
    return () => cancelAnimationFrame(id);
  }, []);
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-glow relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f5c451" />
            <stop offset="100%" stopColor="#ffdd8a" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round" filter="drop-shadow(0 0 6px rgba(245,196,81,.55))"
          strokeDasharray={c} strokeDashoffset={c * (1 - v * anim)} style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)" }} />
        {time !== undefined && (
          <>
            <circle cx={size / 2} cy={size / 2} r={r2} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={3} strokeDasharray="1 5" />
            <circle cx={size / 2} cy={size / 2} r={r2} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth={3} strokeLinecap="round"
              strokeDasharray={c2} strokeDashoffset={c2 * (1 - Math.max(0, Math.min(1, time)) * anim)} style={{ transition: "stroke-dashoffset 1.1s ease" }} />
          </>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ---------------- Misc ---------------- */
export function Empty({ title = "No data for these filters", sub = "Try clearing some filters." }: { title?: string; sub?: string }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center text-[var(--muted)]">
      <SearchX size={28} className="opacity-50" />
      <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
      <div className="text-xs">{sub}</div>
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="page-kicker">GAES 2026</div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function SevChip({ sev }: { sev: string }) {
  const cls = sev === "critical" ? "chip-bad" : sev === "major" ? "chip-accent" : sev === "minor" ? "chip-warn" : "chip-muted";
  return <span className={`chip ${cls} capitalize`}>{sev}</span>;
}
export function BandChip({ band }: { band: string | null }) {
  if (!band) return <span className="text-[var(--muted)]">–</span>;
  const cls = band === "Good" ? "chip-good" : band === "Review" ? "chip-warn" : band === "Poor" ? "chip-accent" : "chip-bad";
  return <span className={`chip ${cls}`}>{band}</span>;
}

export function InlineBar({ value, max, color }: { value: number; max: number; color?: string }) {
  return (
    <div className="bar-track min-w-[60px]">
      <div className="bar-fill" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export function Loading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-80" /><div className="skeleton h-80" />
      </div>
    </div>
  );
}

/* ---------------- Sortable table ---------------- */
export interface Col<T> {
  key: string;
  label: React.ReactNode;
  value?: (r: T) => string | number | null | undefined;
  render?: (r: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  csv?: boolean;
}

export function DataTable<T>({
  rows, cols, initialSort, desc = true, pageSize = 25, onRow, rowKey, maxHeight, compact, empty,
}: {
  rows: T[]; cols: Col<T>[]; initialSort?: string; desc?: boolean; pageSize?: number; onRow?: (r: T) => void;
  rowKey: (r: T) => string; maxHeight?: number; compact?: boolean; empty?: React.ReactNode;
}) {
  const [sort, setSort] = useState<{ key?: string; desc: boolean }>({ key: initialSort, desc });
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sort.key);
    if (!c?.value) return rows;
    const v = c.value;
    return [...rows].sort((a, b) => {
      const x = v(a), y = v(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -r : r;
    });
  }, [rows, cols, sort]);
  useEffect(() => setPage(0), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);
  if (!rows.length) return <>{empty ?? <Empty />}</>;
  return (
    <div>
      <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className={`table ${compact ? "table-compact" : ""}`}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={`${c.value ? "th-sort" : ""} ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}
                  onClick={() => c.value && setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : true })}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort.key === c.key && (sort.desc ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? "cursor-pointer" : ""}>
                {cols.map((c) => (
                  <td key={c.key} className={`${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""} ${c.className ?? ""}`}>
                    {c.render ? c.render(r) : (c.value?.(r) ?? "–")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--muted)]">
          <span>{(page * pageSize + 1).toLocaleString()}–{Math.min(sorted.length, (page + 1) * pageSize).toLocaleString()} of {sorted.length.toLocaleString()}</span>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function tableCsv<T>(rows: T[], cols: Col<T>[]) {
  return rows.map((r) => Object.fromEntries(cols.filter((c) => c.value && c.csv !== false).map((c) => [typeof c.label === "string" ? c.label : c.key, c.value!(r)])));
}
