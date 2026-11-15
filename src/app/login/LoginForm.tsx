"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogIn, User } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const text = await r.text();
      let j: { error?: string; detail?: string } = {};
      try {
        j = JSON.parse(text);
      } catch {
        /* not JSON: a platform error page */
      }
      if (!r.ok) {
        // full details for troubleshooting: open the browser console (F12) and copy this line
        console.error("[login] sign-in failed", { status: r.status, statusText: r.statusText, requestId: r.headers.get("x-nf-request-id"), body: text.slice(0, 2000) });
        throw new Error(j.error ? `${j.error}${j.detail ? ` — ${j.detail}` : ""}` : `Sign-in failed (server error ${r.status}). ${text.slice(0, 200)}`);
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (e) {
      console.error("[login] error", e);
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-card space-y-5">
      <div>
        <div className="page-kicker">GAES 2026 Dashboard</div>
        <h2 className="text-[26px] font-extrabold tracking-[-0.02em]">Sign in</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Use the account given to you by the survey administrator.</p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Username</span>
        <div className="input-icon">
          <User size={16} />
          <input className="input" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Password</span>
        <div className="input-icon">
          <Lock size={16} />
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </label>
      {err && <div className="notice notice-bad" role="alert">{err}</div>}
      <button className="btn btn-primary w-full justify-center py-3" disabled={busy}>
        <LogIn size={16} /> {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="kente-bar !h-[3px] opacity-80" />
      <p className="text-center text-xs text-[var(--muted)]">© {new Date().getFullYear()} Ghana Statistical Service · Authorised users only</p>
    </form>
  );
}
