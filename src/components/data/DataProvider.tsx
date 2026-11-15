"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export const AUTO_RELOAD_MS = 5 * 60_000;
import type { Session } from "@/lib/session";
import { CanExportCtx } from "@/components/ui/kit";
import type { Dataset, Rec } from "@/lib/data/types";

export interface Filters {
  region: string;
  mode: string; // "", "1" CATI, "2" CAPI, "3" CAWI
  team: string;
  interviewer: string;
  section: string; // ISIC section letter
  status: string; // pipeline stage key
  from: string; // yyyy-mm-dd
  to: string;
}

export const EMPTY_FILTERS: Filters = { region: "", mode: "", team: "", interviewer: "", section: "", status: "", from: "", to: "" };

interface Ctx {
  session: Session;
  data: Dataset | null;
  error: string | null;
  loading: boolean;
  refreshing: string | null;
  refresh: () => Promise<void>;
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** interviews after global filters */
  rows: Rec[];
  activeFilterCount: number;
  selected: string | null;
  setSelected: (id: string | null) => void;
  /** interview whose full answers are open in the answers modal */
  answersId: string | null;
  setAnswersId: (id: string | null) => void;
}

const DataCtx = createContext<Ctx | null>(null);

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData must be used inside DataProvider");
  return c;
}

export function applyFilters(rows: Rec[], f: Filters): Rec[] {
  return rows.filter((r) =>
    (!f.region || r.region === f.region) &&
    (!f.mode || String(r.mode ?? "") === f.mode) &&
    (!f.team || String(r.team ?? "") === f.team) &&
    (!f.interviewer || r.interviewer === f.interviewer) &&
    (!f.section || r.isicSection === f.section) &&
    (!f.status || r.stage === f.status) &&
    (!f.from || (r.date ?? "") >= f.from) &&
    (!f.to || (r.date ?? "9999") <= f.to)
  );
}

export function DataProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [answersId, setAnswersId] = useState<string | null>(null);
  const lastLoad = useRef(0);

  const load = useCallback(async (force = false, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/data${force ? "?force=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Could not load data (${r.status})`);
      setData(j);
      lastLoad.current = Date.now();
      setError(null);
    } catch (e) {
      if (!silent) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    try {
      const saved = sessionStorage.getItem("gaes-filters");
      if (saved) setFiltersState({ ...EMPTY_FILTERS, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, [load]);

  // auto-update: quietly reload every 5 minutes while the tab is visible (the server requests
  // a fresh Survey Solutions export by itself when the latest one is older than 30 minutes)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load(false, true);
    };
    const id = setInterval(tick, AUTO_RELOAD_MS);
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > AUTO_RELOAD_MS) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const setFilters = useCallback((f: Filters) => {
    setFiltersState(f);
    try { sessionStorage.setItem("gaes-filters", JSON.stringify(f)); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing("Requesting export…");
    setError(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not start export");
      const ids: number[] = j.jobs.map((x: { jobId: number }) => x.jobId);
      const t0 = Date.now();
      // poll up to 10 minutes
      while (Date.now() - t0 < 600_000) {
        await new Promise((res) => setTimeout(res, 3000));
        const s = await fetch(`/api/refresh?jobs=${ids.join(",")}`, { cache: "no-store" }).then((x) => x.json());
        if (s.error) throw new Error(s.error);
        if (s.failed) throw new Error("Survey Solutions reported a failed export. Try again.");
        const prog = Math.round(s.jobs.reduce((a: number, b: { progress: number; done: boolean }) => a + (b.done ? 100 : b.progress || 0), 0) / s.jobs.length);
        setRefreshing(`Exporting… ${prog}%`);
        if (s.done) break;
      }
      setRefreshing("Processing…");
      await load(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(null);
    }
  }, [load]);

  const rows = useMemo(() => (data ? applyFilters(data.records, filters) : []), [data, filters]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <DataCtx.Provider value={{ session, data, error, loading, refreshing, refresh, filters, setFilters, rows, activeFilterCount, selected, setSelected, answersId, setAnswersId }}>
      <CanExportCtx.Provider value={session.role !== "viewer"}>{children}</CanExportCtx.Provider>
    </DataCtx.Provider>
  );
}
