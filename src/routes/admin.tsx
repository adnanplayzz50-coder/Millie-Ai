import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  adminSignIn,
  adminSignOut,
  adminOverview,
  adminListUpdates,
  adminSaveUpdate,
  adminDeleteUpdate,
  adminGetSettings,
  adminSaveSetting,
  adminListAccounts,
  adminUpdateAccount,
  adminDeleteAccount,
  getAdminSession,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminSession(),
  head: () => ({
    meta: [
      { title: "Millie Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { signedIn } = Route.useLoaderData();
  return <div className="min-h-screen bg-background text-foreground">{signedIn ? <Dashboard /> : <Login />}</div>;
}

function Login() {
  const router = useRouter();
  const signIn = useServerFn(adminSignIn);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    try {
      const res = await signIn({ data: { password } });
      if (res.ok) await router.invalidate();
      else setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Millie Admin</h1>
        <Input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

const TABS = ["Overview", "Update log", "Announcement", "Extension", "Accounts"] as const;
type Tab = (typeof TABS)[number];

function Dashboard() {
  const router = useRouter();
  const signOut = useServerFn(adminSignOut);
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Millie Admin</h1>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            await router.invalidate();
          }}
        >
          Sign out
        </Button>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Overview" && <Overview />}
      {tab === "Update log" && <UpdateLog />}
      {tab === "Announcement" && <Setting kind="announcement" />}
      {tab === "Extension" && <Setting kind="extension" />}
      {tab === "Accounts" && <Accounts />}
    </div>
  );
}

function Notice({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-sm text-muted-foreground">{msg}</p>;
}

function Overview() {
  const [stats, setStats] = useState<{ users: number; chatsToday: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const overview = useServerFn(adminOverview);
  useEffect(() => {
    overview().then(setStats).catch((e) => setErr(e.message));
  }, []);
  const cards = [
    { title: "Users", value: stats?.users },
    { title: "Chats active today", value: stats?.chatsToday },
    { title: "Files created", value: "Coming soon" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{c.title}</p>
            <p className="mt-2 text-2xl font-medium">{c.value ?? "…"}</p>
          </div>
        ))}
      </div>
      <Notice msg={err} />
    </div>
  );
}

function UpdateLog() {
  const list = useServerFn(adminListUpdates);
  const save = useServerFn(adminSaveUpdate);
  const del = useServerFn(adminDeleteUpdate);
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => list().then(setRows).catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);

  const blank = { log_date: new Date().toISOString().slice(0, 10), title: "", body: "", sort_order: 0 };

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await save({ data: { ...editing, sort_order: Number(editing.sort_order) || 0 } });
      setEditing(null);
      await load();
    } catch (err: any) {
      setMsg(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Shown on the site under "What's new", grouped by date (newest first).</p>
        <Button onClick={() => setEditing({ ...blank })}>New entry</Button>
      </div>

      {editing && (
        <form onSubmit={onSave} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="date" value={editing.log_date} onChange={(e) => setEditing({ ...editing, log_date: e.target.value })} required />
            <Input placeholder="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
            <Input placeholder="Order in day" type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
          </div>
          <textarea
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            rows={3}
            placeholder="Short description"
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{r.log_date}</p>
              <p className="font-medium">{r.title}</p>
              <p className="text-sm text-muted-foreground">{r.body}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing({ ...r })}>Edit</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm(`Delete "${r.title}"?`)) return;
                await del({ data: { id: r.id } });
                load();
              }}
            >
              Delete
            </Button>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No entries yet.</p>}
      </div>
      <Notice msg={msg} />
    </div>
  );
}

function Setting({ kind }: { kind: "announcement" | "extension" }) {
  const getAll = useServerFn(adminGetSettings);
  const save = useServerFn(adminSaveSetting);
  const [value, setValue] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getAll().then((all) => setValue(all[kind] ?? {})).catch((e) => setMsg(e.message));
  }, [kind]);

  const fields =
    kind === "announcement"
      ? [
          { key: "enabled", label: "Show the banner on the site", type: "bool" },
          { key: "text", label: "Banner text", type: "text" },
        ]
      : [
          { key: "version", label: "Current extension version (e.g. 9.1.0)", type: "text" },
          { key: "download_url", label: "Download link", type: "text" },
          { key: "notes", label: "Release notes", type: "area" },
        ];

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await save({ data: { key: kind, value } });
      setMsg("Saved.");
    } catch (err: any) {
      setMsg(err.message);
    }
  }

  return (
    <form onSubmit={onSave} className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{kind === "announcement" ? "Announcement banner" : "Chrome extension"}</h2>
      {fields.map((f) =>
        f.type === "bool" ? (
          <label key={f.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!value[f.key]} onChange={(e) => setValue({ ...value, [f.key]: e.target.checked })} />
            {f.label}
          </label>
        ) : f.type === "area" ? (
          <div key={f.key} className="space-y-1">
            <p className="text-sm text-muted-foreground">{f.label}</p>
            <textarea
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              rows={4}
              value={value[f.key] ?? ""}
              onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
            />
          </div>
        ) : (
          <div key={f.key} className="space-y-1">
            <p className="text-sm text-muted-foreground">{f.label}</p>
            <Input value={value[f.key] ?? ""} onChange={(e) => setValue({ ...value, [f.key]: e.target.value })} />
          </div>
        ),
      )}
      <Button type="submit">Save</Button>
      <Notice msg={msg} />
    </form>
  );
}

function Accounts() {
  const list = useServerFn(adminListAccounts);
  const update = useServerFn(adminUpdateAccount);
  const remove = useServerFn(adminDeleteAccount);
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => list().then(setRows).catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);

  async function rename(r: any) {
    const name = prompt("Display name", r.display_name ?? "");
    if (name === null) return;
    try {
      await update({ data: { id: r.id, display_name: name } });
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function toggle(r: any) {
    try {
      await update({ data: { id: r.id, disabled: !r.disabled } });
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function destroy(r: any) {
    if (!confirm(`Permanently delete ${r.email}? This cannot be undone.`)) return;
    const typed = prompt("Type DELETE to confirm");
    if (typed !== "DELETE") return;
    try {
      await remove({ data: { id: r.id, confirm: "DELETE" } });
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{rows.length} accounts</p>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.display_name || "(no name)"}</p>
            <p className="truncate text-sm text-muted-foreground">{r.email}</p>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(r.created_at).toLocaleDateString()} · {r.disabled ? "Disabled" : "Active"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => rename(r)}>Rename</Button>
          <Button variant="outline" size="sm" onClick={() => toggle(r)}>{r.disabled ? "Enable" : "Disable"}</Button>
          <Button variant="outline" size="sm" onClick={() => destroy(r)}>Delete</Button>
        </div>
      ))}
      <Notice msg={msg} />
    </div>
  );
}
