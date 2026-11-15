import Link from "next/link";
import { LayoutDashboard, MapPinned, ShieldCheck, Timer, BarChart3, Users2, Download, Filter, MousePointerClick, RefreshCw } from "lucide-react";

export const metadata = { title: "How to use · GAES 2026 Dashboard" };

const PAGES = [
  { href: "/", icon: LayoutDashboard, title: "Overview", who: "Everyone — start here", text: "Where the survey stands today: completes against the sample, whether we are on pace, what needs attention, and a map of where interviews are happening." },
  { href: "/progress", icon: MapPinned, title: "Fieldwork progress", who: "Survey managers, team leads", text: "Daily trend against the required pace, the outcome of every call attempt, progress by region, district, team and sector, and where interviews sit in supervisor/HQ review." },
  { href: "/quality", icon: ShieldCheck, title: "Data quality", who: "Supervisors, data managers", text: "104 automated checks. Each completed interview gets a 0–100 score. The work list shows which interviews to call back or reject, worst first, with a link straight into Survey Solutions." },
  { href: "/timing", icon: Timer, title: "Timing & paradata", who: "Data managers", text: "How long interviews really take (from answer timestamps), who is unusually fast, when calls are made, and an interviewer's day as a timeline to spot overlaps." },
  { href: "/statistics", icon: BarChart3, title: "Statistical outputs", who: "Analysts, management", text: "Preliminary, unweighted figures on employment, revenue, costs, assets and credit from clean interviews only. Small cells are suppressed." },
  { href: "/interviewers", icon: Users2, title: "Interviewers & teams", who: "Supervisors, field coordinators", text: "Each interviewer's assignments, yield, pace and quality index; each supervisor's review backlog and speed." },
  { href: "/downloads", icon: Download, title: "Data & downloads", who: "Data managers, admins", text: "Request a fresh export, download the clean dataset, flags and dictionary, and enter region/sector targets." },
];

const SEV = [
  { c: "chip-bad", n: "Critical", d: "Data can't be used or suggests fabrication (e.g. interview under 10 minutes, totals that don't add up, respondent phone = interviewer's phone). Must be fixed before approval. Any critical flag puts the interview in the Reject band." },
  { c: "chip-accent", n: "Major", d: "Likely error — call the respondent back or correct (e.g. paid staff but zero wages, wage per worker far below minimum wage, percentage entered as a head-count)." },
  { c: "chip-warn", n: "Minor", d: "Worth a look; may be genuine (e.g. operating loss, electricity cost doesn't match grid spend, call outside calling hours)." },
  { c: "chip-muted", n: "Info", d: "Context only, never scored (e.g. no financial records kept, weekend call)." },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">How to use this dashboard</h1>
        <p className="page-sub">A two-minute guide for anyone opening the GAES 2026 dashboard for the first time.</p>
      </div>

      <section className="hero">
        <h2 className="text-2xl font-extrabold">What is GAES 2026?</h2>
        <p className="mt-2 max-w-3xl text-white/85">
          The Ghana Annual Economic Survey interviews about 10,000 business establishments from the IBES business register about their 2025 fiscal year:
          employment, revenue, expenses, investment, assets, credit and trade. Interviews are done mainly by phone (CATI) by 74 interviewers in 5 teams,
          with face-to-face (CAPI) or web on request, over 33 fieldwork days, weekends included, from 13 November to 15 December 2026. Data is collected in Survey Solutions; this dashboard reads it through the Survey Solutions API.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><Filter size={20} className="text-[var(--gss-primary)]" /><div className="mt-2 font-semibold">Filters apply everywhere</div><p className="mt-1 text-sm text-[var(--muted)]">Region, mode, sector, team, interviewer, status and dates at the top filter every chart and table until you clear them.</p></div>
        <div className="card p-5"><MousePointerClick size={20} className="text-[var(--gss-primary)]" /><div className="mt-2 font-semibold">Click to drill down</div><p className="mt-1 text-sm text-[var(--muted)]">Click a region on the map, a bar or a team card to filter. Click any interview row to see all its flags and open it in Survey Solutions.</p></div>
        <div className="card p-5"><RefreshCw size={20} className="text-[var(--gss-primary)]" /><div className="mt-2 font-semibold">Refresh for the latest</div><p className="mt-1 text-sm text-[var(--muted)]">The top bar shows when data was exported. Supervisors and admins can press Refresh to request a new export (takes about a minute).</p></div>
      </div>

      <div className="card divide-y divide-[var(--border)]">
        {PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="flex gap-4 p-5 transition hover:bg-[var(--surface-2)]">
            <span className="stat-icon"><p.icon size={20} /></span>
            <span>
              <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.title}</span><span className="chip chip-muted">{p.who}</span></span>
              <span className="mt-1 block text-sm text-[var(--muted)]">{p.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="section-title">Reading quality flags</h2>
        <div className="mt-4 space-y-3">
          {SEV.map((s) => (
            <div key={s.n} className="flex gap-3"><span className={`chip ${s.c} h-fit w-20 justify-center`}>{s.n}</span><p className="text-sm text-[var(--muted)]">{s.d}</p></div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">Quality score bands: <b>Good</b> 85–100 · <b>Review</b> 70–84 · <b>Poor</b> 50–69 · <b>Reject</b> below 50 or any critical flag.</p>
      </div>

      <div className="card p-6">
        <h2 className="section-title">Important definitions</h2>
        <dl className="mt-3 grid gap-4 text-sm md:grid-cols-2">
          <div><dt className="font-semibold">Completed interview</dt><dd className="text-[var(--muted)]">Has an end time and the credit question answered. The questionnaire has no result code, so outcomes are derived from the call-outcome questions.</dd></div>
          <div><dt className="font-semibold">Active interview time</dt><dd className="text-[var(--muted)]">Sum of the gaps between answers between the start and end stamps, each capped at 5 minutes. The questionnaire&apos;s own &ldquo;timespent&rdquo; is wall-clock and can be reset, so it is not used.</dd></div>
          <div><dt className="font-semibold">Cooperation rate</dt><dd className="text-[var(--muted)]">Completes ÷ (complete + partial + refused) — among establishments that were reached.</dd></div>
          <div><dt className="font-semibold">Operating expenses</dt><dd className="text-[var(--muted)]">Labour + goods for resale + operating + services + financial + taxes. The questionnaire&apos;s total also adds opening and closing stock, so it overstates expenses and is not published.</dd></div>
          <div><dt className="font-semibold">Statistical outputs</dt><dd className="text-[var(--muted)]">Unweighted and preliminary: only completed interviews without open critical flags and not returned for correction. Not for publication.</dd></div>
          <div><dt className="font-semibold">Interviewer quality index</dt><dd className="text-[var(--muted)]">0–100 combining mean interview score, critical-free share, pace, rejections, heaping and zero-filling. Speed is never rewarded as quality.</dd></div>
        </dl>
      </div>
    </div>
  );
}
