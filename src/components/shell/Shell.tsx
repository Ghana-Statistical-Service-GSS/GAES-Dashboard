"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MapPinned, ShieldCheck, Timer, BarChart3, Users2, Download, UserCog, LogOut, RefreshCw,
  Menu, X, Moon, Sun, BookOpen,
} from "lucide-react";
import type { Session } from "@/lib/session";
import { useData } from "@/components/data/DataProvider";
import FilterBar from "./FilterBar";
import InterviewDrawer from "@/components/data/InterviewDrawer";
import AnswersModal from "@/components/data/AnswersModal";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, hint: "Start here" },
  { href: "/progress", label: "Fieldwork progress", icon: MapPinned },
  { href: "/quality", label: "Data quality", icon: ShieldCheck },
  { href: "/timing", label: "Timing & paradata", icon: Timer },
  { href: "/statistics", label: "Statistical outputs", icon: BarChart3 },
  { href: "/interviewers", label: "Interviewers & teams", icon: Users2 },
  { href: "/downloads", label: "Data & downloads", icon: Download },
  { href: "/guide", label: "How to use", icon: BookOpen },
];

function ago(iso?: string | null) {
  if (!iso) return "—";
  const s = (Date.now() - Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z")) / 1000; // Survey Solutions times are UTC
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Shell({ session, children }: { session: Session; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, refresh, refreshing, error } = useData();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    try {
      const t = localStorage.getItem("gaes-theme");
      const isDark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(isDark);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
    } catch { /* ignore */ }
    const i = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("gaes-theme", next ? "dark" : "light"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("gaes-theme"));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = session.role === "admin" ? [...NAV, { href: "/users", label: "User management", icon: UserCog }] : NAV;
  const showFilters = !["/users", "/guide", "/downloads"].includes(pathname);

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo-ring"><img src="/gss-logo.png" alt="Ghana Statistical Service" /></div>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">GAES 2026 Dashboard</div>
            <div className="text-[11px] opacity-75">Ghana Statistical Service</div>
          </div>
          <button className="icon-btn ml-auto text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className={`nav-link ${active ? "nav-link-on" : ""}`}>
                <Icon size={18} />
                <span>{n.label}</span>
                {"hint" in n && n.hint && !active && <span className="nav-hint">{n.hint}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="flex items-center gap-3">
            <div className="avatar">{session.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">{session.name}</div>
              <div className="text-[11px] capitalize opacity-75">{session.role}{session.regions.length ? ` · ${session.regions.length} region(s)` : ""}</div>
            </div>
            <button className="icon-btn ml-auto text-white" title="Sign out" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {open && <div className="scrim lg:hidden" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{nav.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))?.label ?? "Dashboard"}</div>
            <div className="truncate text-xs text-[var(--muted)]">
              {data ? <>Data exported from Survey Solutions <b>{ago(data.exportedAt)}</b> · {data.totals.records.toLocaleString()} interview records · {data.totals.complete.toLocaleString()} completed<span className="hidden md:inline"> · updates automatically</span></> : error ? <span className="text-[var(--bad)]">{error}</span> : "Loading data…"}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {session.role !== "viewer" && (
              <button className="btn btn-primary" onClick={refresh} disabled={!!refreshing} title="Ask Survey Solutions for a fresh export">
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{refreshing ? refreshing : "Refresh data"}</span>
              </button>
            )}
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>
        <div className="kente-bar !rounded-none !h-[3px]" />
        {showFilters && <FilterBar />}
        <main className="content">{children}</main>
        <InterviewDrawer />
        <AnswersModal />
        <footer className="px-6 pb-6 pt-2 text-xs text-[var(--muted)]">
          Ghana Statistical Service · GAES 2026 monitoring dashboard · Figures are unweighted and preliminary unless stated.
        </footer>
      </div>
    </div>
  );
}
