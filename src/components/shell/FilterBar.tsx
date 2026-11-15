"use client";

import { useMemo, useState } from "react";
import { Filter, RotateCcw, ChevronDown } from "lucide-react";
import { EMPTY_FILTERS, useData, type Filters } from "@/components/data/DataProvider";

export default function FilterBar() {
  const { data, filters, setFilters, activeFilterCount, rows } = useData();
  const [open, setOpen] = useState(false);

  const opts = useMemo(() => {
    const recs = data?.records ?? [];
    const uniq = <T,>(a: T[]) => [...new Set(a.filter((x) => x !== null && x !== undefined && x !== ""))];
    return {
      regions: uniq(recs.map((r) => r.region)).sort() as string[],
      teams: (uniq(recs.map((r) => r.team)) as number[]).sort((a, b) => a - b),
      interviewers: uniq(recs.map((r) => r.interviewer)).sort() as string[],
      sections: uniq(recs.map((r) => r.isicSection)).sort() as string[],
    };
  }, [data]);

  if (!data) return null;
  const set = (k: keyof Filters, v: string) => setFilters({ ...filters, [k]: v });

  return (
    <div className="filterbar">
      <button className="filter-toggle md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Filter size={15} /> Filters {activeFilterCount ? <span className="badge">{activeFilterCount}</span> : null}
        <ChevronDown size={15} className={open ? "rotate-180" : ""} />
      </button>
      <div className={`filter-wrap ${open ? "max-md:mt-2" : "max-md:hidden"}`}>
      <div className="filter-grid">
        <Sel label="Region" value={filters.region} onChange={(v) => set("region", v)} options={opts.regions.map((r) => [r, title(r)])} />
        <Sel label="Mode" value={filters.mode} onChange={(v) => set("mode", v)} options={[["1", "CATI · phone"], ["2", "CAPI · face-to-face"], ["3", "CAWI · web"]]} />
        <Sel label="Sector" value={filters.section} onChange={(v) => set("section", v)}
          options={opts.sections.map((s) => [s, `${s} · ${data.isicSections[s] ?? ""}`.slice(0, 48)])} />
        <Sel label="Team" value={filters.team} onChange={(v) => set("team", v)} options={opts.teams.map((t) => [String(t), `Team ${t}`])} />
        <Sel label="Interviewer" value={filters.interviewer} onChange={(v) => set("interviewer", v)} options={opts.interviewers.map((i) => [i, data.interviewerNames[i] ? `${i} · ${data.interviewerNames[i]}` : i])} />
        <Sel label="Status" value={filters.status} onChange={(v) => set("status", v)} options={data.stages.map((s) => [s.key, s.label])} />
        <label className="filter-item">
          <span>From</span>
          <input type="date" className="input input-sm" value={filters.from} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label className="filter-item">
          <span>To</span>
          <input type="date" className="input input-sm" value={filters.to} onChange={(e) => set("to", e.target.value)} />
        </label>
      </div>
        <div className="filter-meta">
          <span className={`filter-count ${activeFilterCount ? "filter-count-on" : ""}`} aria-live="polite">
            {activeFilterCount ? `${rows.length.toLocaleString()} of ${data.records.length.toLocaleString()} shown` : `${data.records.length.toLocaleString()} interviews`}
          </span>
          {activeFilterCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              <RotateCcw size={14} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function title(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string[])[] }) {
  return (
    <label className="filter-item">
      <span>{label}</span>
      <select className={`input input-sm ${value ? "input-on" : ""}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
