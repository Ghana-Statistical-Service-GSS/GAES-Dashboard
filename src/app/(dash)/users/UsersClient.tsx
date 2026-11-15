"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, KeyRound, Plus, Shield, Trash2, Upload, UserCheck, UserX, Users as UsersIcon, X } from "lucide-react";

type Role = "admin" | "supervisor" | "viewer";
interface PublicUser {
  username: string;
  name: string;
  email?: string;
  role: Role;
  regions: string[];
  active: boolean;
  createdAt: string;
  createdBy: string;
  lastLoginAt?: string;
}
interface Payload {
  users: PublicUser[];
  bootstrap: PublicUser | null;
  storage: { kind: string; persistent: boolean; note: string };
  updatedAt: string;
}

const REGIONS = [
  "AHAFO", "ASHANTI", "BONO", "BONO EAST", "CENTRAL", "EASTERN", "GREATER ACCRA", "NORTH EAST",
  "NORTHERN", "OTI", "SAVANNAH", "UPPER EAST", "UPPER WEST", "VOLTA", "WESTERN", "WESTERN NORTH",
];

const ROLE_INFO: Record<Role, { label: string; desc: string; cls: string }> = {
  admin: { label: "Administrator", desc: "Everything, including creating users", cls: "chip-primary" },
  supervisor: { label: "Supervisor", desc: "Dashboard, quality checks and data downloads", cls: "chip-accent" },
  viewer: { label: "Viewer", desc: "Read-only dashboard", cls: "chip-muted" },
};

function fmtDate(s?: string) {
  if (!s || s === "env") return "—";
  const d = new Date(s);
  return isNaN(+d) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("") + "@" + (a[0] % 90 + 10);
}

const emptyForm = { username: "", name: "", email: "", password: "", role: "viewer" as Role, regions: [] as string[] };

export default function UsersClient({ me }: { me: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/users", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setErr(j.error || "Could not load users");
    else setData(j);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  };

  async function call(method: string, body?: unknown, qs = "") {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/users" + qs, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
      await load();
      return j;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const j = await call("POST", form);
    if (j) {
      flash(`User “${form.username}” created`);
      setForm(emptyForm);
      setShowForm(false);
    }
  }

  async function importFile(f: File) {
    try {
      const arr = JSON.parse(await f.text());
      const j = await call("POST", { import: Array.isArray(arr) ? arr : arr.users });
      if (j) flash(`Imported ${j.imported} user(s)`);
    } catch {
      setErr("That file is not a valid users.json backup");
    }
  }

  const users = useMemo(() => {
    const list = data?.users ?? [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((u) => `${u.username} ${u.name} ${u.email ?? ""} ${u.role}`.toLowerCase().includes(s)) : list;
  }, [data, q]);

  const counts = useMemo(() => {
    const l = data?.users ?? [];
    return { total: l.length, active: l.filter((u) => u.active).length, admins: l.filter((u) => u.role === "admin").length };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">User management</h1>
          <p className="page-sub">Create accounts for supervisors and stakeholders. Accounts are stored as a JSON file — no database needed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={16} /> Import JSON
          </button>
          <a className="btn btn-ghost" href="/api/users?export=1">
            <Download size={16} /> Export users.json
          </a>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setForm({ ...emptyForm, password: genPassword() }); }}>
            <Plus size={16} /> New user
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </div>
      </div>

      {data && (
        <div className={`notice ${data.storage.persistent ? "notice-ok" : "notice-warn"}`}>
          <Shield size={16} className="shrink-0" />
          <span>{data.storage.note}</span>
        </div>
      )}
      {err && <div className="notice notice-bad"><X size={16} /> {err}</div>}
      {msg && <div className="notice notice-ok"><UserCheck size={16} /> {msg}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="User accounts" value={counts.total} icon={<UsersIcon size={18} />} />
        <Stat label="Active" value={counts.active} icon={<UserCheck size={18} />} />
        <Stat label="Administrators" value={counts.admins + (data?.bootstrap ? 1 : 0)} icon={<Shield size={18} />} hint="incl. system admin" />
      </div>

      {showForm && (
        <form onSubmit={create} className="card space-y-5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Create a user</h2>
            <button type="button" className="icon-btn" onClick={() => setShowForm(false)} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full name">
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ama Mensah" />
            </Field>
            <Field label="Username" hint="3–32 characters: letters, numbers, . _ -">
              <input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "") })} placeholder="e.g. amensah" />
            </Field>
            <Field label="Email (optional)">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@statsghana.gov.gh" />
            </Field>
            <Field label="Password" hint="At least 8 characters. Share it securely.">
              <div className="flex gap-2">
                <input className="input font-mono" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" className="btn btn-ghost whitespace-nowrap" onClick={() => setForm({ ...form, password: genPassword() })}>Generate</button>
              </div>
            </Field>
          </div>
          <Field label="Role">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
                <label key={r} className={`choice ${form.role === r ? "choice-on" : ""}`}>
                  <input type="radio" name="role" className="sr-only" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
                  <span className="font-semibold">{ROLE_INFO[r].label}</span>
                  <span className="text-xs text-[var(--muted)]">{ROLE_INFO[r].desc}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Region access" hint="Leave empty for all regions. Restricted users only see interviews from the selected regions.">
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => {
                const on = form.regions.includes(r);
                return (
                  <button type="button" key={r} className={`pill ${on ? "pill-on" : ""}`}
                    onClick={() => setForm({ ...form, regions: on ? form.regions.filter((x) => x !== r) : [...form.regions, r] })}>
                    {r}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}><Plus size={16} /> Create user</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="section-title">Accounts</h2>
          <input className="input max-w-xs" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Regions</th><th>Status</th><th>Last sign-in</th><th>Created</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.bootstrap && (
                <tr>
                  <td><div className="font-semibold">{data.bootstrap.username}</div><div className="text-xs text-[var(--muted)]">System administrator (from environment)</div></td>
                  <td><span className="chip chip-primary">Administrator</span></td>
                  <td>All</td>
                  <td><span className="chip chip-good">Active</span></td>
                  <td>—</td><td>—</td>
                  <td className="text-right text-xs text-[var(--muted)]">Managed in env vars</td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.username} className={u.active ? "" : "opacity-60"}>
                  <td>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-[var(--muted)]">{u.username}{u.email ? ` · ${u.email}` : ""}</div>
                  </td>
                  <td>
                    <select className="input input-sm" value={u.role} disabled={busy || u.username === me}
                      onChange={(e) => call("PATCH", { username: u.username, role: e.target.value })}>
                      <option value="admin">Administrator</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="max-w-[220px] text-xs">{u.regions.length ? u.regions.join(", ") : "All"}</td>
                  <td>{u.active ? <span className="chip chip-good">Active</span> : <span className="chip chip-bad">Disabled</span>}</td>
                  <td className="text-xs">{fmtDate(u.lastLoginAt)}</td>
                  <td className="text-xs">{fmtDate(u.createdAt)}<div className="text-[var(--muted)]">by {u.createdBy}</div></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="icon-btn" title="Reset password" onClick={() => { setResetFor(u); setResetPw(genPassword()); }}><KeyRound size={16} /></button>
                      {u.username !== me && (
                        <>
                          <button className="icon-btn" title={u.active ? "Disable" : "Enable"} onClick={() => call("PATCH", { username: u.username, active: !u.active })}>
                            {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                          <button className="icon-btn icon-btn-bad" title="Delete" onClick={() => {
                            if (confirm(`Delete user “${u.username}”? This cannot be undone.`)) call("DELETE", undefined, `?username=${encodeURIComponent(u.username)}`);
                          }}><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data && users.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-[var(--muted)]">No users yet — click <b>New user</b> to create the first account.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetFor && (
        <div className="modal-backdrop" onClick={() => setResetFor(null)}>
          <div className="card w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">Reset password for {resetFor.name}</h3>
            <div className="flex gap-2">
              <input className="input font-mono" value={resetPw} onChange={(e) => setResetPw(e.target.value)} minLength={8} />
              <button className="btn btn-ghost" onClick={() => setResetPw(genPassword())}>Generate</button>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setResetFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy || resetPw.length < 8} onClick={async () => {
                const j = await call("PATCH", { username: resetFor.username, password: resetPw });
                if (j) { flash(`Password updated for ${resetFor.username}`); setResetFor(null); }
              }}>Save password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold">{label}</div>
      {children}
      {hint && <div className="text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

function Stat({ label, value, icon, hint }: { label: string; value: number; icon: React.ReactNode; hint?: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-sm text-[var(--muted)]">{label}{hint ? <span className="text-xs"> · {hint}</span> : null}</div>
      </div>
    </div>
  );
}
