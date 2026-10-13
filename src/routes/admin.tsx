import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminSignIn, adminSignOut, getAdminSession } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminSession(),
  head: () => ({
    meta: [
      { title: "Millie Admin" },
      { name: "description", content: "Private admin area for Millie AI." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Millie Admin" },
      { property: "og:description", content: "Private admin area for Millie AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { signedIn } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {signedIn ? <Dashboard /> : <Login />}
    </div>
  );
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

function Dashboard() {
  const router = useRouter();
  const signOut = useServerFn(adminSignOut);
  // TODO: replace "Coming soon" with real numbers from an admin-only server function
  // (e.g. count of profiles, conversations created today, files generated).
  const cards = [
    { title: "Users" /* real value: total profiles */ },
    { title: "Chats today" /* real value: conversations created since midnight */ },
    { title: "Files created" /* real value: generated file cards count */ },
  ];
  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8 flex items-center justify-between">
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
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{c.title}</p>
            {/* Real number goes here later */}
            <p className="mt-2 text-lg">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  );
}
