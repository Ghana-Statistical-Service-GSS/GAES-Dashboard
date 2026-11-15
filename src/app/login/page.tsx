import { Suspense } from "react";
import { BarChart3, MapPinned, ShieldCheck } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · GAES 2026 Dashboard" };

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-hero">
        {/* decorative progress rings — echo the dashboard's hero */}
        <svg className="login-rings login-extra" viewBox="0 0 620 620" fill="none" aria-hidden>
          <circle cx="310" cy="310" r="300" stroke="rgba(255,255,255,.07)" strokeWidth="2" />
          <circle cx="310" cy="310" r="240" stroke="rgba(255,255,255,.09)" strokeWidth="26" />
          <circle cx="310" cy="310" r="240" stroke="#f5c451" strokeOpacity=".55" strokeWidth="26" strokeLinecap="round" strokeDasharray="420 1508" transform="rotate(-150 310 310)" />
          <circle cx="310" cy="310" r="176" stroke="rgba(255,255,255,.08)" strokeWidth="2" strokeDasharray="2 8" />
          <circle cx="310" cy="310" r="176" stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeLinecap="round" strokeDasharray="200 1106" transform="rotate(-150 310 310)" />
        </svg>
        <div className="login-hero-inner">
          <div className="flex items-center gap-3">
            <div className="logo-ring !h-14 !w-14"><img src="/gss-logo.png" alt="Ghana Statistical Service" /></div>
            <div className="leading-tight">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">Ghana Statistical Service</div>
              <div className="mt-0.5 text-xs text-white/75">Business, Industry and Trade Directorate</div>
            </div>
          </div>
          <div className="my-auto max-w-xl py-10">
            <div className="kente-bar mb-6 w-24" />
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f5c451]">Fieldwork monitor</div>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[56px]">Ghana Annual Economic Survey 2026</h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/85">
              Fieldwork monitoring and data-quality dashboard — live from Survey Solutions.
            </p>
            <ul className="login-extra mt-8 max-w-md space-y-2.5">
              <li className="login-feature"><span className="ico"><MapPinned size={17} /></span> Progress against sample targets, by region and sector</li>
              <li className="login-feature"><span className="ico"><ShieldCheck size={17} /></span> Automated quality checks, timing and interviewer performance</li>
              <li className="login-feature"><span className="ico"><BarChart3 size={17} /></span> Preliminary statistics and clean data downloads</li>
            </ul>
          </div>
          <div className="login-extra text-xs text-white/65">About 10,000 business establishments · 16 regions · 13 Nov – 31 Dec 2026</div>
        </div>
      </section>
      <section className="login-panel">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
