import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { getAdminSession } from "@/lib/admin.functions";
import { adminListSupport, adminSetResolved } from "@/lib/support.functions";

export const Route = createFileRoute("/admin/support")({
  loader: () => getAdminSession(),
  head: () => ({ meta: [{ title: "Millie Admin · Support" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SupportPage,
});

type Row = {
  id: string;
  name: string | null;
  email: string;
  topic: string;
  message: string;
  resolved: boolean;
  created_at: string;
};

function SupportPage() {
  const signedIn = !!Route.useLoaderData()?.signedIn;
  const router = useRouter();
  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Sign in to the admin panel first.</p>
        <Link to="/admin" className="text-primary underline">
          Go to admin sign-in
        </Link>
        <Button variant="outline" onClick={() => router.invalidate()}>
          I've signed in, refresh
        </Button>
      </div>
    );
  }
  return <Inbox />;
}

function Inbox() {
  const list = useServerFn(adminListSupport);
  const setResolved = useServerFn(adminSetResolved);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => list().then((r) => setRows(r as Row[])).catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);

  const shown = rows.filter((r) => (filter === "all" ? true : filter === "resolved" ? r.resolved : !r.resolved));

  async function toggle(r: Row) {
    try {
      await setResolved({ data: { id: r.id, resolved: !r.resolved } });
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="size-8" />
            <h1 className="text-2xl font-semibold">Support questions</h1>
          </div>
          <Link to="/admin" className="text-sm text-primary underline">
            Back to admin
          </Link>
        </header>

        <nav className="flex gap-2">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${filter === f ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              {f}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">{r.topic}</span>
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <span>{r.resolved ? "Resolved" : "Open"}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {r.name ? `${r.name} · ` : ""}
                  <a href={`mailto:${r.email}`} className="text-primary underline">
                    {r.email}
                  </a>
                </p>
                <Button variant="outline" size="sm" onClick={() => toggle(r)}>
                  {r.resolved ? "Mark open" : "Mark resolved"}
                </Button>
              </div>
            </div>
          ))}
          {!shown.length && <p className="text-sm text-muted-foreground">No questions here.</p>}
        </div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </div>
    </div>
  );
}
