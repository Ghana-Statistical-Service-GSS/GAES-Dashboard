/** Formatting + small statistics helpers shared by client pages. */

export const fmt = (x: number | null | undefined, d = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? "–" : x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });

export const pct = (x: number | null | undefined, d = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? "–" : `${(x * 100).toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d })}%`;

export function compact(x: number | null | undefined, d = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toFixed(d)}bn`;
  if (a >= 1e6) return `${(x / 1e6).toFixed(d)}m`;
  if (a >= 1e4) return `${(x / 1e3).toFixed(0)}k`;
  if (a >= 1e3) return `${(x / 1e3).toFixed(d)}k`;
  return fmt(x, a < 10 && x % 1 ? 1 : 0);
}

export const cedi = (x: number | null | undefined) => (x === null || x === undefined ? "–" : `GH₵ ${compact(x)}`);

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function quantile(a: number[], q: number): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const sum = (a: (number | null | undefined)[]) => a.reduce<number>((x, y) => x + (y ?? 0), 0);
export const nums = <T,>(rows: T[], f: (r: T) => number | null | undefined) =>
  rows.map(f).filter((x): x is number => typeof x === "number" && Number.isFinite(x));

export function countBy<T>(rows: T[], f: (r: T) => string | number | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = f(r);
    if (k === null || k === undefined || k === "") continue;
    m.set(String(k), (m.get(String(k)) ?? 0) + 1);
  }
  return m;
}
export function groupBy<T>(rows: T[], f: (r: T) => string | number | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = f(r);
    if (k === null || k === undefined || k === "") continue;
    const key = String(k);
    let g = m.get(key);
    if (!g) m.set(key, (g = []));
    g.push(r);
  }
  return m;
}

export const titleCase = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T12:00:00Z");
  const e = new Date(to + "T12:00:00Z");
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const shortDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function toCSV(rows: Record<string, unknown>[], cols?: string[]): string {
  if (!rows.length) return "";
  const c = cols ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join(";") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [c.join(","), ...rows.map((r) => c.map((k) => esc(r[k])).join(","))].join("\n");
}

export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
