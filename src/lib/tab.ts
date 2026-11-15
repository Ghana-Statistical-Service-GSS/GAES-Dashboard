/** Parser for Survey Solutions tab-delimited export files. */

export type Row = Record<string, string>;

/** Survey Solutions missing-value conventions in tabular exports. */
export const NUM_MISSING = new Set(["", "-999999999", ".", "##N/A##"]);
export const STR_MISSING = new Set(["", "##N/A##"]);

export function parseTab(text: string): Row[] {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  if (!lines.length) return [];
  const header = lines[0].split("\t");
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split("\t");
    const r: Row = {};
    for (let j = 0; j < header.length; j++) r[header[j]] = cells[j] ?? "";
    rows.push(r);
  }
  return rows;
}

/** Numeric value or null when missing / not numeric. */
export function num(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (NUM_MISSING.has(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function str(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return STR_MISSING.has(s) ? null : s;
}

/** Parse "DD.HH:MM:SS" (Survey Solutions TimeSpan) into seconds. */
export function timespanSeconds(v: string | undefined | null): number | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!m) return null;
  const [, d, h, mi, se] = m;
  return (Number(d || 0) * 24 + Number(h)) * 3600 + Number(mi) * 60 + Number(se);
}
