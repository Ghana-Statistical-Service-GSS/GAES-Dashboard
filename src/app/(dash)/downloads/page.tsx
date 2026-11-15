"use client";

import { useEffect, useState } from "react";
import { CloudDownload, Database, FileSpreadsheet, FileWarning, Users2, BookText, RefreshCw, Target, Save, CheckCircle2, Server, Archive } from "lucide-react";
import { useData } from "@/components/data/DataProvider";
import { Card, Loading, PageHeader } from "@/components/ui/kit";
import { ALL_REGIONS } from "@/components/charts/RegionMap";
import { fmt, titleCase } from "@/lib/fmt";

const SECTIONS = "ABCDEFGHIJKLMNOPQRSTUV".split("");

export default function DownloadsPage() {
  const { data, session, refresh, refreshing, error } = useData();
  const [byRegion, setByRegion] = useState<Record<string, string>>({});
  const [bySection, setBySection] = useState<Record<string, string>>({});
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/targets").then((r) => r.json()).then((j) => {
      setByRegion(Object.fromEntries(Object.entries(j.byRegion ?? {}).map(([k, v]) => [k, String(v)])));
      setBySection(Object.fromEntries(Object.entries(j.bySection ?? {}).map(([k, v]) => [k, String(v)])));
    }).catch(() => undefined);
  }, []);

  if (!data) return <Loading />;
  const admin = session.role === "admin";
  const viewer = session.role === "viewer";

  function applyPaste() {
    // accepts "Region,Target" lines or "A,123" for sections
    const r: Record<string, string> = { ...byRegion };
    const s: Record<string, string> = { ...bySection };
    let n = 0;
    for (const line of paste.split(/\r?\n/)) {
      const [k, v] = line.split(/[,\t;]/).map((x) => x?.trim());
      if (!k || !v || !/^\d+$/.test(v)) continue;
      const key = k.toUpperCase().replace(/\s+REGION$/, "");
      if (ALL_REGIONS.includes(key)) { r[key] = v; n++; }
      else if (/^[A-V]$/.test(key)) { s[key] = v; n++; }
    }
    setByRegion(r); setBySection(s);
    setMsg(n ? `Read ${n} target(s) from the pasted text — review and click Save.` : "No region or section targets recognised. Use lines like “Ashanti,1234” or “C,800”.");
  }

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ byRegion, bySection }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Could not save"); return; }
    setMsg("Targets saved. Reloading figures…");
    await refreshSoft();
  }
  async function refreshSoft() {
    location.reload();
  }

  const regionSum = Object.values(byRegion).reduce((a, b) => a + (Number(b) || 0), 0);
  const sectionSum = Object.values(bySection).reduce((a, b) => a + (Number(b) || 0), 0);

  const downloads = viewer ? [] : [
    { href: "/api/download/clean", icon: <FileSpreadsheet size={20} />, title: "Cleaned interview data (CSV)", desc: `One row per interview: all questionnaire answers plus derived variables (disposition, quality score, operating expenses, size class…). ${admin ? "Includes respondent identifiers (admin)." : "Respondent phone numbers and names removed."}` },
    { href: "/api/download/flags", icon: <FileWarning size={20} />, title: "Quality flags (CSV)", desc: "One row per flag — the daily error report for supervisors, with check, severity and message." },
    { href: "/api/download/interviewers", icon: <Users2 size={20} />, title: "Interviewer summary (CSV)", desc: "Assignments, attempts, completes, timing, quality index and alerts per interviewer." },
    { href: "/api/download/dictionary", icon: <BookText size={20} />, title: "Data dictionary (CSV)", desc: "Every variable in the cleaned file with its question text or derivation." },
    ...(admin ? [{ href: "/api/download/raw", icon: <Archive size={20} />, title: "Raw Survey Solutions export (ZIP)", desc: "The original tabular export as delivered by the Survey Solutions API (admin only)." }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Data & downloads" sub="Pull fresh data from Survey Solutions, download clean files, and maintain the sample targets." />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={<span className="flex items-center gap-2"><Server size={17} /> Survey Solutions connection</span>}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="eyebrow">Server</dt><dd className="font-medium">{data.server.replace(/^https?:\/\//, "")}</dd></div>
            <div><dt className="eyebrow">Workspace</dt><dd className="font-medium">{data.workspace}</dd></div>
            <div><dt className="eyebrow">Questionnaire</dt><dd className="font-medium">{data.questionnaires[0]?.title} · {data.questionnaires.map((q) => `v${q.version} (${fmt(q.records)})`).join(" + ")}{data.questionnaires.length > 1 ? " — merged" : ""}</dd></div>
            <div><dt className="eyebrow">Last export</dt><dd className="font-medium">{data.exportedAt ? new Date(data.exportedAt.endsWith("Z") ? data.exportedAt : data.exportedAt + "Z").toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " GMT" : "–"}</dd></div>
            <div><dt className="eyebrow">Interviews in this view</dt><dd className="font-medium">{fmt(data.records.length)} ({fmt(data.totals.complete)} complete{data.totals.deleted ? `, ${data.totals.deleted} deleted ignored` : ""})</dd></div>
            <div><dt className="eyebrow">Processed</dt><dd className="font-medium">{new Date(data.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
          </dl>
          {error && <div className="notice notice-bad mt-4">{error} — the previous data is still shown.</div>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!viewer ? (
              <button className="btn btn-primary" onClick={refresh} disabled={!!refreshing}>
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> {refreshing ?? "Export fresh data now"}
              </button>
            ) : <span className="text-sm text-[var(--muted)]">Viewers see the latest export; supervisors and admins can request a new one.</span>}
            <span className="text-xs text-[var(--muted)]">Requests a new Tabular + Paradata export (all interview statuses), waits for Survey Solutions to finish, then re-runs all {data.checks.length} checks.</span>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Database size={17} /> What happens on refresh</span>}>
          <ol className="space-y-2 text-sm">
            {["Export API v2 builds the tabular and paradata files", "Files are downloaded and unzipped on the server", "Deleted, test and duplicate interviews are set aside", "Paradata gives active time, pacing and sessions", `${data.checks.length} quality checks, scores and indices are computed`, "Region restrictions and privacy rules are applied per user"].map((s, k) => (
              <li key={k} className="flex gap-2.5"><span className="step-n !h-5 !w-5 !text-[10px]">{k + 1}</span><span>{s}</span></li>
            ))}
          </ol>
        </Card>
      </div>

      <div>
        <h2 className="section-title mb-3 flex items-center gap-2"><CloudDownload size={18} /> Downloads</h2>
        {viewer && <div className="notice">Data files (cleaned data, quality flags, interviewer summary and data dictionary) can be downloaded by supervisor and administrator accounts only.</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {downloads.map((d) => (
            <a key={d.href} href={d.href} className="card group flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-[var(--gss-line)] hover:shadow-lg">
              <span className="stat-icon">{d.icon}</span>
              <span className="min-w-0">
                <span className="block font-semibold group-hover:text-[var(--gss-primary)]">{d.title}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">{d.desc}</span>
              </span>
            </a>
          ))}
        </div>
      </div>

      <Card title={<span className="flex items-center gap-2"><Target size={17} /> Sample targets</span>}
        sub="National, team and interviewer targets come automatically from Survey Solutions assignments. Region and sector targets are not in the export, so enter them from the sample file to unlock completion percentages by region and sector.">
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-xl font-bold">{fmt(data.targets.national)}</div><div className="text-xs text-[var(--muted)]">National (assignments)</div></div>
          <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-xl font-bold">{Object.keys(data.targets.byTeam).length}</div><div className="text-xs text-[var(--muted)]">Team targets</div></div>
          <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-xl font-bold">{Object.keys(data.targets.byInterviewer).length}</div><div className="text-xs text-[var(--muted)]">Interviewer targets</div></div>
          <div className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-xl font-bold">{data.targets.regionSource === "uploaded" ? <span className="flex items-center gap-1 text-[var(--good)]"><CheckCircle2 size={18} /> Loaded</span> : "Not loaded"}</div><div className="text-xs text-[var(--muted)]">Region & sector targets</div></div>
        </div>
        {admin ? (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Regions</span><span className={regionSum && regionSum !== data.targets.national ? "text-[#b06d00]" : "text-[var(--muted)]"}>Sum {fmt(regionSum)}{regionSum && regionSum !== data.targets.national ? ` (national ${fmt(data.targets.national)})` : ""}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_REGIONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate">{titleCase(r)}</span>
                      <input className="input input-sm" inputMode="numeric" value={byRegion[r] ?? ""} onChange={(e) => setByRegion({ ...byRegion, [r]: e.target.value.replace(/\D/g, "") })} placeholder="0" />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>ISIC sections (optional)</span><span className="text-[var(--muted)]">Sum {fmt(sectionSum)}</span></div>
                <div className="grid grid-cols-3 gap-2">
                  {SECTIONS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-xs" title={data.isicSections[s]}>
                      <span className="w-5 font-mono font-bold">{s}</span>
                      <input className="input input-sm" inputMode="numeric" value={bySection[s] ?? ""} onChange={(e) => setBySection({ ...bySection, [s]: e.target.value.replace(/\D/g, "") })} placeholder="0" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-sm font-semibold">…or paste from Excel</div>
              <textarea className="input min-h-[90px] font-mono text-xs" placeholder={"Greater Accra,2025\nAshanti,1500\nC,800"} value={paste} onChange={(e) => setPaste(e.target.value)} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className="btn btn-ghost" onClick={applyPaste} disabled={!paste.trim()}>Read pasted targets</button>
                <button className="btn btn-primary" onClick={save} disabled={busy}><Save size={16} /> Save targets</button>
                {msg && <span className="text-sm text-[var(--muted)]">{msg}</span>}
              </div>
            </div>
          </div>
        ) : <p className="text-sm text-[var(--muted)]">Only administrators can change targets.</p>}
      </Card>
    </div>
  );
}
