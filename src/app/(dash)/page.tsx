"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight, AlertOctagon, Clock, Undo2, MapPin, UserX, Activity, ShieldCheck, Users2, BarChart3, MapPinned,
  CheckCircle2, PhoneCall, Timer, BadgeCheck, Stamp, Gauge, CalendarDays, TrendingUp, TrendingDown, Target, Flag, Map as MapIcon,
} from "lucide-react";
import { useData } from "@/components/data/DataProvider";
import { Card, CountUp, Kpi, Loading, ProgressRing, Empty } from "@/components/ui/kit";
import RegionMap from "@/components/charts/RegionMap";
import TeamCards from "@/components/data/Teams";
import RecordsBreakdown from "@/components/data/RecordsBreakdown";
import EChart from "@/components/charts/EChart";
import { axisStyle, baseOption, useChartTheme } from "@/components/ui/theme";
import { daily, paceOf, surveyDays, targetFor, todayOf } from "@/lib/series";
import { countBy, fmt, median, nums, pct, shortDate, titleCase } from "@/lib/fmt";

export default function OverviewPage() {
  const { data, rows, filters, setFilters, error, activeFilterCount } = useData();
  const t = useChartTheme();

  const m = useMemo(() => {
    if (!data) return null;
    const today = todayOf(data);
    const days = surveyDays(data);
    const pace = paceOf(data);
    const target = targetFor(data, filters);
    const complete = rows.filter((r) => r.disp === "COMPLETE");
    const attempted = rows.filter((r) => r.disp !== "NOT_STARTED");
    const coopDen = rows.filter((r) => ["Complete", "Partial", "Refused"].includes(r.dispGroup)).length;
    const dailyComplete = daily(complete, days, (r) => r.completeDate);
    const dailyAttempt = daily(attempted, days, (r) => r.date);
    // approved by a supervisor at some point: awaiting HQ, returned by HQ, or approved by HQ (matches the Progress pipeline)
    const supApproved = rows.filter((r) => r.status === 120 || r.status === 125 || r.status === 130);
    const hqApproved = rows.filter((r) => r.status === 130);
    const critical = complete.filter((r) => r.nCritical > 0);
    const durs = nums(complete, (r) => r.activeMin);
    const lastDay = days.length ? dailyComplete[dailyComplete.length - 1] : 0;
    const prevDay = days.length > 1 ? dailyComplete[dailyComplete.length - 2] : null;
    const remaining = target.value ? Math.max(0, target.value - complete.length) : null;
    const neededPerDay = remaining !== null ? remaining / Math.max(1, pace.left) : null;
    const expected = target.value ? (target.value * pace.elapsed) / Math.max(1, pace.total) : null;
    const onTrack = expected !== null ? complete.length >= 0.95 * expected : null;
    const activeToday = new Set(attempted.filter((r) => r.date === days[days.length - 1]).map((r) => r.interviewer)).size;
    const activeInterviewers = new Set(attempted.map((r) => r.interviewer)).size;

    // daily cumulative median duration & critical share for sparklines
    const dailyCrit = daily(critical, days, (r) => r.completeDate);
    const dailySup = daily(supApproved, days, (r) => r.completeDate);
    const dailyHq = daily(hqApproved, days, (r) => r.completeDate);
    const dailyMedDur = days.map((d) => median(nums(complete.filter((r) => r.completeDate === d), (r) => r.activeMin)) ?? 0);
    const dailyActive = days.map((d) => new Set(attempted.filter((r) => r.date === d).map((r) => r.interviewer)).size);
    const dailyCoop = days.map((d) => {
      const x = rows.filter((r) => r.date === d);
      const den = x.filter((r) => ["Complete", "Partial", "Refused"].includes(r.dispGroup)).length;
      return den ? (x.filter((r) => r.disp === "COMPLETE").length / den) * 100 : 0;
    });

    // pipeline
    const stage = countBy(rows, (r) => r.stage);

    // regions
    const byRegion: Record<string, number> = {};
    const attByRegion: Record<string, number> = {};
    for (const r of complete) if (r.region) byRegion[r.region] = (byRegion[r.region] ?? 0) + 1;
    for (const r of attempted) if (r.region) attByRegion[r.region] = (attByRegion[r.region] ?? 0) + 1;
    const regionTargets = data.targets.byRegion;
    const hasRegionTargets = data.targets.regionSource === "uploaded";
    const regionValue: Record<string, number> = {};
    for (const reg of new Set([...Object.keys(attByRegion), ...Object.keys(regionTargets)])) {
      regionValue[reg] = hasRegionTargets ? (regionTargets[reg] ? (byRegion[reg] ?? 0) / regionTargets[reg] : 0) : byRegion[reg] ?? 0;
    }

    // attention
    // same definition as the KPI tile: completed interviews with at least one critical flag
    const flagsOpenCritical = critical.length;
    const returned48 = data.flags.filter((f) => f.check === "DQ-PR-03").length;
    const waiting48 = data.flags.filter((f) => f.check === "DQ-PR-02").length;
    const lowYield = Object.entries(attByRegion)
      .filter(([reg, a]) => a >= 10 && (byRegion[reg] ?? 0) / a < 0.25)
      .map(([reg, a]) => ({ reg, a, c: byRegion[reg] ?? 0 }));
    const ibFlagged = new Set(data.flags.filter((f) => f.check.startsWith("DQ-IB") && f.sev !== "info").map((f) => f.interviewer)).size;
    const inactive = data.interviewers.filter((i) => i.flags.includes("DQ-IB-09")).length;
    const neverStarted = data.interviewers.filter((i) => i.assigned > 0 && i.attempted === 0).length;
    const lapsed = data.interviewers.filter((i) => i.flags.includes("DQ-IB-09") && i.attempted > 0).length;
    const notOnTablet = data.interviewers.filter((i) => i.assigned > 0 && i.receivedOnTablet === 0).length;

    return {
      today, days, pace, target, complete, attempted, coopRate: coopDen ? complete.length / coopDen : null,
      dailyComplete, dailyAttempt, supApproved, hqApproved, critical, medDur: median(durs),
      lastDay, prevDay, remaining, neededPerDay, expected, onTrack, activeToday, activeInterviewers,
      dailyCrit, dailySup, dailyHq, dailyMedDur, dailyActive, dailyCoop, stage, byRegion, attByRegion, regionValue,
      hasRegionTargets, flagsOpenCritical, returned48, waiting48, lowYield, ibFlagged, inactive, notOnTablet, neverStarted, lapsed,
    };
  }, [data, rows, filters]);

  if (!data || !m) return error ? <div className="notice notice-bad">{error}</div> : <Loading />;

  const completion = m.target.value ? m.complete.length / m.target.value : 0;
  const delta = m.prevDay !== null ? m.lastDay - m.prevDay : null;

  const attention = [
    m.flagsOpenCritical > 0 && { icon: <AlertOctagon size={18} />, tone: "bad", title: `${m.flagsOpenCritical} completed interview${m.flagsOpenCritical > 1 ? "s" : ""} with a critical flag`, sub: "Possible fabrication, wrong totals or impossible timing — resolve before approval.", href: "/quality?sev=critical" },
    m.lowYield.length > 0 && { icon: <MapPin size={18} />, tone: "warn", title: `Low completion in ${m.lowYield.map((x) => titleCase(x.reg)).join(", ")}`, sub: m.lowYield.map((x) => `${titleCase(x.reg)}: ${x.c} complete of ${x.a} attempted`).join(" · "), href: "/progress" },
    (m.stage.get("ret_sup") ?? 0) + (m.stage.get("ret_hq") ?? 0) > 0 && { icon: <Undo2 size={18} />, tone: "warn", title: `${(m.stage.get("ret_sup") ?? 0) + (m.stage.get("ret_hq") ?? 0)} interviews returned for correction`, sub: m.returned48 ? `${m.returned48} have been waiting more than 48 h.` : "Interviewers should fix and resubmit them today.", href: "/progress#pipeline" },
    (m.stage.get("sup") ?? 0) > 0 && { icon: <Clock size={18} />, tone: m.waiting48 ? "warn" : "info", title: `${m.stage.get("sup")} interviews awaiting supervisor review`, sub: m.waiting48 ? `${m.waiting48} have waited more than 48 h.` : "Supervisors should review completed interviews daily.", href: "/interviewers#supervisors" },
    m.ibFlagged > 0 && { icon: <Activity size={18} />, tone: "warn", title: `${m.ibFlagged} interviewer${m.ibFlagged > 1 ? "s" : ""} with unusual patterns`, sub: "Short interviews, zero-filling, heaping or high rejection rates.", href: "/interviewers" },
    m.neverStarted + m.lapsed > 0 && { icon: <UserX size={18} />, tone: "info", title: m.neverStarted ? `${m.neverStarted} of ${data.survey.interviewersTotal} interviewers have not started yet` : `${m.lapsed} interviewer${m.lapsed > 1 ? "s" : ""} with no interviews in the last 2 fieldwork days`, sub: `${m.lapsed && m.neverStarted ? `${m.lapsed} more have had no interviews in the last 2 fieldwork days. ` : ""}${m.notOnTablet ? `${m.notOnTablet} have not yet received their assignments on a tablet.` : "Check in with their supervisors."}`, href: "/interviewers" },
  ].filter(Boolean).slice(0, 6) as { icon: React.ReactNode; tone: string; title: string; sub: string; href: string }[];

  // timeline chart
  const cum = m.dailyComplete.reduce<number[]>((a, x) => [...a, (a[a.length - 1] ?? 0) + x], []);

  const stages = [
    { key: "progress", label: "In progress", icon: <PhoneCall size={16} /> },
    { key: "sup", label: "Awaiting supervisor", icon: <Clock size={16} /> },
    { key: "hq", label: "Awaiting HQ", icon: <BadgeCheck size={16} /> },
    { key: "approved", label: "Approved by HQ", icon: <Stamp size={16} /> },
  ];
  const returned = (m.stage.get("ret_sup") ?? 0) + (m.stage.get("ret_hq") ?? 0);

  const regionRank = Object.entries(m.hasRegionTargets ? m.regionValue : m.byRegion)
    .concat(Object.keys(m.attByRegion).filter((r) => !(r in m.byRegion) && !m.hasRegionTargets).map((r) => [r, 0] as [string, number]))
    .sort((a, b) => b[1] - a[1]);
  const regionBar = {
    ...baseOption(t),
    grid: { left: 8, right: 76, top: 4, bottom: 4, containLabel: true },
    tooltip: { ...t.tooltip, confine: true, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(139,127,240,.10)" : "rgba(60,47,163,.06)" } },
      formatter: (ps: { name: string; value: number; dataIndex: number }[]) => {
        const p0 = ps[0]; const reg = regionRank[p0.dataIndex][0];
        return `<div style="font-weight:700;margin-bottom:2px">${p0.name}</div>${m.hasRegionTargets ? `Completion: <b>${pct(p0.value)}</b><br/>` : ""}Completed: <b>${m.byRegion[reg] ?? 0}</b><br/>Attempted: <b>${m.attByRegion[reg] ?? 0}</b>`;
      } },
    xAxis: { type: "value", show: false, max: m.hasRegionTargets ? 1 : undefined },
    yAxis: { type: "category", inverse: true, data: regionRank.map(([r]) => titleCase(r)), ...axisStyle(t), axisLine: { show: false }, axisLabel: { color: t.text, fontSize: 12.5, fontFamily: "Inter, sans-serif", margin: 12 } },
    series: [{
      type: "bar", barWidth: 14, data: regionRank.map(([r, v]) => ({ value: v, itemStyle: { color: r === filters.region ? t.gold : { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: t.dark ? "#6b5ce0" : "#5040c9" }, { offset: 1, color: t.primary }] }, borderRadius: 7 } })),
      showBackground: true, backgroundStyle: { color: t.grid, borderRadius: 7 },
      label: { show: true, position: "right", distance: 8, color: t.text, fontWeight: 700, fontSize: 12, formatter: (p: { value: number; dataIndex: number }) => m.hasRegionTargets ? pct(p.value) : `${p.value} of ${m.attByRegion[regionRank[p.dataIndex][0]] ?? 0}` },
    }],
  };

  const lineCol = t.palette[1];
  const paceChart = {
    ...baseOption(t),
    grid: { left: 8, right: 64, top: 44, bottom: 4, containLabel: true },
    tooltip: { ...t.tooltip, confine: true, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.dark ? "rgba(139,127,240,.10)" : "rgba(60,47,163,.06)" } } },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 8, itemGap: 18, textStyle: { color: t.muted, fontSize: 12 } },
    xAxis: { type: "category", data: m.days.map(shortDate), ...axisStyle(t), axisLabel: { ...axisStyle(t).axisLabel, margin: 12 } },
    yAxis: { type: "value", minInterval: 1, ...axisStyle(t), axisLine: { show: false }, splitLine: { lineStyle: { color: t.grid, type: [3, 4] } } },
    series: [
      { name: "Completed that day", type: "bar", data: m.dailyComplete, barMaxWidth: 44, barMinHeight: 2,
        itemStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: t.dark ? "#a59be3" : "#5040c9" }, { offset: 1, color: t.primary }] }, borderRadius: [7, 7, 0, 0] },
        label: { show: m.days.length <= 16, position: "insideTop", distance: 8, color: t.dark ? "#16132b" : "#fff", fontWeight: 700, fontSize: 12, formatter: (p: { value: number }) => (p.value > 0 ? fmt(p.value) : "") } },
      { name: "Running total", type: "line", data: cum, smooth: 0.25, symbol: "circle", symbolSize: 8, z: 5,
        lineStyle: { color: lineCol, width: 3, cap: "round" }, itemStyle: { color: lineCol, borderColor: t.surface, borderWidth: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: lineCol + "2e" }, { offset: 1, color: lineCol + "00" }] } },
        endLabel: { show: true, formatter: (p: { value: number }) => `${fmt(p.value)} total`, color: lineCol, fontWeight: 700, fontSize: 12, distance: 8 } },
    ],
  };

  const regionsCovered = Object.keys(m.attByRegion).length;
  const lastDayLabel = m.days.length ? shortDate(m.days[m.days.length - 1]) : "the latest day";
  const behindBy = Math.max(0, (m.expected ?? 0) - m.complete.length);
  const toneLabel: Record<string, string> = { bad: "Critical", warn: "Act", info: "Monitor" };
  const stageTotal = stages.reduce((a, s) => a + (m.stage.get(s.key) ?? 0), 0);

  return (
    <div className="space-y-7">
      {/* ---------------- HERO ---------------- */}
      <section className="hero fade-up" aria-label="Survey status">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:gap-10">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
              <span>Ghana Statistical Service</span><span className="opacity-50">•</span><span>Fieldwork monitor</span>
              {activeFilterCount > 0 && <span className="chip !bg-[#f5c451] !text-[#1a1343] normal-case tracking-normal">Filtered view</span>}
            </div>
            <h1 className="mt-2.5 text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[42px]">Ghana Annual Economic Survey 2026</h1>

            {/* status headline — the whole story in one line */}
            <p className="hero-headline mt-5" role="status">
              <span><b><CountUp value={m.complete.length} /></b> of {m.target.value ? fmt(m.target.value) : "–"} interviews done</span>
              {m.onTrack === null ? <span className="hero-pill hero-pill-muted"><Target size={13} /> No target set</span>
                : m.onTrack ? <span className="hero-pill hero-pill-good"><TrendingUp size={13} /> On track</span>
                : <span className="hero-pill hero-pill-bad"><TrendingDown size={13} /> Behind pace by {fmt(behindBy)} interviews</span>}
              {m.flagsOpenCritical > 0
                ? <Link href="/quality?sev=critical" className="hero-pill hero-pill-warn transition hover:brightness-95"><Flag size={13} /> {fmt(m.flagsOpenCritical)} interview{m.flagsOpenCritical > 1 ? "s" : ""} with a critical flag</Link>
                : <span className="hero-pill hero-pill-good"><ShieldCheck size={13} /> No critical issues</span>}
            </p>
            <RecordsBreakdown />
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
              Ghana&apos;s first annual survey of about <b className="font-semibold text-white">{fmt(data.targets.national)}</b> business establishments,
              collected mainly by telephone (CATI) from {shortDate(data.survey.fieldStart)} to {shortDate(data.survey.fieldEnd)} 2026, for fiscal year 2025.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="hero-stat"><div className="k"><CalendarDays size={13} /> Fieldwork day</div><div className="v">{m.pace.elapsed}<span className="text-base font-semibold text-white/65"> / {m.pace.total}</span></div><div className="l">fieldwork days elapsed</div></div>
              <div className="hero-stat"><div className="k"><Target size={13} /> Required pace</div><div className="v text-[#f5c451]">{m.neededPerDay !== null ? fmt(m.neededPerDay) : "–"}</div><div className="l">completes needed per day</div></div>
              <div className="hero-stat"><div className="k"><CheckCircle2 size={13} /> Latest day</div><div className="v">{fmt(m.lastDay)}</div><div className="l">completed on {lastDayLabel} (latest fieldwork day)</div></div>
              <div className="hero-stat"><div className="k"><MapIcon size={13} /> Coverage</div><div className="v">{regionsCovered}<span className="text-base font-semibold text-white/65"> / 16</span></div><div className="l">regions with fieldwork</div></div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/80">
                <span>{shortDate(data.survey.fieldStart)} · start</span>
                <span className="hidden text-white/70 sm:inline">Work done against time used</span>
                <span>end · {shortDate(data.survey.fieldEnd)}</span>
              </div>
              <div className="tl-track" role="img" aria-label={`Work done ${pct(completion, 1)}, time used ${pct(m.pace.timeShare)}`}>
                <div className="tl-time" style={{ width: `${Math.min(100, m.pace.timeShare * 100)}%` }} />
                <div className="tl-work" style={{ width: `${Math.min(100, completion * 100)}%` }} />
                <div className="tl-today" style={{ left: `${Math.min(100, m.pace.timeShare * 100)}%` }} title="Today" />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-white/80">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3.5 rounded-full bg-[#f5c451]" />Work done <b className="tabular-nums text-white">{pct(completion, 1)}</b></span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3.5 rounded-full bg-white/45" />Time used <b className="tabular-nums text-white">{pct(m.pace.timeShare)}</b> <span className="text-white/65">(white marker = today)</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 xl:px-2">
            <ProgressRing value={completion} time={m.pace.timeShare} size={236} stroke={18}>
              <div>
                <div className="text-[52px] font-extrabold leading-none tracking-[-0.04em] text-[#f5c451] tabular-nums"><CountUp value={m.complete.length} /></div>
                <div className="mt-1.5 text-xs text-white/80">of {m.target.value ? fmt(m.target.value) : "–"} completed</div>
                <div className="mx-auto mt-2.5 w-fit rounded-full bg-white/12 px-3 py-0.5 text-base font-bold tabular-nums">{pct(completion, 1)}</div>
                <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">{m.target.label}</div>
              </div>
            </ProgressRing>
            <div className="flex items-center gap-4 text-[11px] text-white/75">
              <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-4 rounded-full bg-[#f5c451]" />completed</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded-full bg-white/85" />time used</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- KPIs ---------------- */}
      <div>
        <div className="sec-head"><h2>Key numbers</h2><p>Totals so far, with the daily trend</p></div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi label="Completed interviews" icon={<CheckCircle2 size={16} />} value={<CountUp value={m.complete.length} />} spark={m.dailyComplete} delta={delta} accent="#3c2fa3"
            sub={`${fmt(m.lastDay)} on ${lastDayLabel}${m.prevDay !== null ? ` · ${fmt(m.prevDay)} the day before` : ""}`} hint="Interviews with an end time and the credit question answered" />
          <Kpi label="Establishments attempted" icon={<PhoneCall size={16} />} value={<CountUp value={m.attempted.length} />} spark={m.dailyAttempt} accent="#2f6db5"
            sub={`${pct(m.attempted.length ? m.complete.length / m.attempted.length : null)} ended in a complete interview`} hint="Any interview with a recorded call outcome or start" />
          <Kpi label="Cooperation rate" icon={<TrendingUp size={16} />} value={pct(m.coopRate)} spark={m.dailyCoop} accent="#0e8a7e"
            sub="Completes ÷ (complete + partial + refused)" hint="Among establishments that were reached" />
          <Kpi label="Median interview length" icon={<Timer size={16} />} value={<>{fmt(m.medDur, 1)}<span className="u"> min</span></>} spark={m.dailyMedDur} accent="#d17a22"
            sub="Active time from paradata · design ≈ 30 min" hint="Excludes idle gaps over 5 minutes" />
          <Kpi label="Approved by supervisor" icon={<BadgeCheck size={16} />} value={<CountUp value={m.supApproved.length} />} spark={m.dailySup} accent="#3c2fa3"
            sub={`${pct(m.complete.length ? m.supApproved.length / m.complete.length : null)} of completes`} />
          <Kpi label="Approved by HQ" icon={<Stamp size={16} />} value={<CountUp value={m.hqApproved.length} />} spark={m.dailyHq} accent="#0f7a55"
            sub="Final, accepted interviews" />
          <Kpi label="Interviews with a critical flag" icon={<AlertOctagon size={16} />} value={<CountUp value={m.critical.length} />} spark={m.dailyCrit} accent="#b43c2a" goodWhenUp={false}
            sub={`${pct(m.complete.length ? m.critical.length / m.complete.length : null, 1)} of completes`} onClick={() => location.assign("/quality?sev=critical")} />
          <Kpi label="Interviewers active on latest day" icon={<Users2 size={16} />} value={<>{m.activeToday}<span className="u"> / {data.survey.interviewersTotal}</span></>} spark={m.dailyActive} accent="#b4436c"
            sub={`${m.activeInterviewers} have worked at least once`} hint="Interviewers with an attempt on the latest fieldwork day" />
        </div>
      </div>

      {/* ---------------- Attention + pace ---------------- */}
      <div>
        <div className="sec-head"><h2>Where to look first</h2><p>Issues ordered by severity, and the daily pace</p></div>
        <div className="grid gap-4 xl:grid-cols-5">
          <Card title={<span className="flex items-center gap-2">Needs attention {attention.length > 0 && <span className="chip chip-bad !px-2 !text-[11px]">{attention.length}</span>}</span>} sub="Most severe first — click a row to drill down" className="xl:col-span-2">
            {attention.length === 0 ? <Empty title="Nothing urgent" sub="All checks are within limits." /> : (
              <ol className="-mx-2 space-y-1">
                {attention.map((a, k) => (
                  <li key={k}>
                    <Link href={a.href} className={`attn group ${k === 0 && a.tone === "bad" ? "attn-first" : ""}`}>
                      <span className="attn-rank max-sm:hidden" aria-hidden>{k + 1}</span>
                      <span className={`stat-icon !h-9 !w-9 !rounded-[10px] ${a.tone === "bad" ? "!bg-[var(--bad-bg)] !text-[var(--bad)]" : a.tone === "warn" ? "!bg-[var(--warn-bg)] !text-[var(--warn)]" : ""}`}>{a.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug">{a.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
                          <span className={`chip mr-1.5 !px-1.5 !py-0 align-[1px] !text-[10px] uppercase tracking-wide ${a.tone === "bad" ? "chip-bad" : a.tone === "warn" ? "chip-warn" : "chip-primary"}`}>{toneLabel[a.tone]}</span>
                          {a.sub}
                        </span>
                      </span>
                      <ArrowRight size={16} className="mt-2.5 shrink-0 text-[var(--muted)] opacity-60 transition group-hover:translate-x-0.5 group-hover:text-[var(--gss-primary)] group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title={`${fmt(m.complete.length)} interviews completed so far`} sub={`Bars = interviews completed each fieldwork day · line = running total${m.neededPerDay !== null ? ` · ${fmt(m.neededPerDay)} a day needed from now` : ""}`} className="flex flex-col xl:col-span-3 [&>div:last-child]:flex [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
            {m.days.length ? <div className="min-h-[300px] flex-1"><EChart option={paceChart} height="100%" ariaLabel={`Daily completed interviews: ${m.days.map((d, k) => `${shortDate(d)} ${m.dailyComplete[k]}`).join(", ")}. Running total ${m.complete.length}.`} /></div> : <Empty />}
          </Card>
        </div>
      </div>

      {/* ---------------- Teams ---------------- */}
      <div>
        <div className="sec-head"><h2>Teams</h2><p>Interviews completed by each team and who is in charge — open a team to see every interviewer&apos;s completion rate</p></div>
        <TeamCards />
      </div>

      {/* ---------------- Pipeline + Regions ---------------- */}
      <div>
        <div className="sec-head"><h2>Where the work is</h2><p>Review pipeline and regional spread</p></div>
        <div className="space-y-4">
          <Card title="Where the interviews are in review" sub="Survey Solutions status pipeline — interviewers → supervisors → HQ">
            <div className="pipe">
              {stages.map((s, k) => {
                const n = m.stage.get(s.key) ?? 0;
                return (
                  <div key={s.key} className={`pipe-step ${k === stages.length - 1 ? "pipe-step-final" : ""}`}>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><span className="stat-icon !h-7 !w-7 !rounded-lg">{s.icon}</span><span>{s.label}</span></div>
                    <div className="n mt-2.5">{fmt(n)}</div>
                    <div className="bar-track mt-2.5 !h-1.5" aria-hidden><div className="bar-fill" style={{ width: `${stageTotal ? (n / stageTotal) * 100 : 0}%`, background: k === stages.length - 1 ? "var(--good)" : "var(--gss-primary)" }} /></div>
                  </div>
                );
              })}
            </div>
            <div className="pipe-return">
              <Undo2 size={16} className="shrink-0" />
              <span><b className="tabular-nums">{fmt(returned)}</b> returned to interviewers for correction ({fmt(m.stage.get("ret_sup") ?? 0)} by supervisors, {fmt(m.stage.get("ret_hq") ?? 0)} by HQ)</span>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3" title={m.hasRegionTargets ? "Completion against target by region" : "Completed interviews by region"}
              sub={m.hasRegionTargets ? "Share of each region's sample completed. Click a bar to filter the dashboard." : "Labels show completed of attempted. Click a bar to filter the dashboard. Region targets are not loaded yet — admins can add them on Data & downloads."}>
              {regionRank.length ? <EChart option={regionBar} height={Math.max(220, regionRank.length * 28)} ariaLabel="Completed interviews by region, ranked" onClick={(p) => {
                const name = (p as { name?: string }).name; if (name) setFilters({ ...filters, region: filters.region === name.toUpperCase() ? "" : name.toUpperCase() });
              }} /> : <Empty />}
            </Card>
            <Card className="xl:col-span-2" title="Map of Ghana" sub="Stronger colour = more completes. Hover for numbers, click a region to filter the whole dashboard.">
              <RegionMap values={m.hasRegionTargets ? Object.fromEntries(Object.entries(m.regionValue).map(([k, v]) => [k, Math.round(v * 100)])) : m.byRegion}
                label={m.hasRegionTargets ? "Completion %" : "Completed"} format={m.hasRegionTargets ? (v) => `${v}%` : undefined}
                selected={filters.region} height={Math.max(360, regionRank.length * 28 - 20)}
                extra={(r) => `Attempted: <b>${m.attByRegion[r] ?? 0}</b>`}
                onSelect={(r) => setFilters({ ...filters, region: filters.region === r ? "" : r })} />
            </Card>
          </div>
        </div>
      </div>

      {/* ---------------- Where to start ---------------- */}
      <div>
        <div className="sec-head"><h2>Explore further</h2><p>Each page answers one question</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/progress", icon: <MapPinned size={20} />, title: "Fieldwork progress", q: "Are we keeping up?", v: pct(completion, 1), d: "of the sample completed — by region, team, day and mode" },
            { href: "/quality", icon: <ShieldCheck size={20} />, title: "Data quality", q: "Can we trust the answers?", v: fmt(m.critical.length), d: "completed interviews with a critical flag to resolve" },
            { href: "/interviewers", icon: <Users2 size={20} />, title: "Interviewers & teams", q: "Who needs support?", v: fmt(m.activeInterviewers), d: `of ${data.survey.interviewersTotal} interviewers have started work` },
            { href: "/statistics", icon: <BarChart3 size={20} />, title: "Statistical outputs", q: "What do the data say?", v: fmt(rows.filter((r) => r.analysable).length), d: "clean interviews feed the preliminary estimates" },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="card card-link group p-5">
              <div className="flex items-center gap-3">
                <span className="stat-icon">{c.icon}</span>
                <span className="min-w-0 flex-1 leading-tight"><span className="block text-sm font-bold">{c.title}</span><span className="block text-xs text-[var(--muted)]">{c.q}</span></span>
                <ArrowRight size={18} className="text-[var(--muted)] opacity-60 transition group-hover:translate-x-1 group-hover:text-[var(--gss-primary)] group-hover:opacity-100" />
              </div>
              <div className="mt-4 text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{c.v}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{c.d}</div>
            </Link>
          ))}
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-[var(--muted)]"><Gauge size={13} className="mt-0.5 shrink-0" /> Pace assumes {m.pace.total} fieldwork days ({shortDate(data.survey.fieldStart)}–{shortDate(data.survey.fieldEnd)}{data.survey.weekendsAreWorkdays ? ", weekends included" : ", weekdays only"}). Statistics are unweighted and preliminary.</p>
    </div>
  );
}
