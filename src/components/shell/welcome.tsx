import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { submitSupport } from "@/lib/support.functions";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to Millie AI" },
      { name: "description", content: "Millie AI is a calm, friendly AI companion for chat, code, and more." },
    ],
  }),
  component: Welcome,
});

const FEATURES = [
  { title: "Chat", text: "Ask anything and get clear, friendly answers, with your chats saved for later." },
  { title: "C0DE", text: "A coding helper that builds whole projects, with copy buttons and ZIP downloads." },
  { title: "Screen help", text: "Select part of a page or share your screen, and Millie explains what it sees." },
  { title: "Voice", text: "Talk to Millie, or type. Say \"Hey Millie\" to start hands-free in Chrome or Edge." },
  { title: "Memory", text: "Millie remembers the details you choose to share, so you don't repeat yourself." },
  { title: "Projects", text: "Group chats together, with instructions and files that every chat in the project can use." },
];

function Welcome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Logo className="size-9" />
          <span className="font-read text-xl">Millie AI</span>
        </div>
        <a href="/chat" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Open Millie
        </a>
      </header>

      <main className="mx-auto max-w-5xl space-y-20 px-6 pb-16">
        <section className="space-y-5 pt-10 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Welcome</p>
          <h1 className="font-read text-4xl tracking-tight sm:text-5xl">Hi, I'm Millie.</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            I'm an AI companion built to be clear, calm, and genuinely useful. Ask me questions, write with me, build
            projects, or talk through what's on your screen.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <a href="/chat" className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground">
              Start chatting
            </a>
            <a href="#support" className="rounded-full border border-border px-6 py-3 font-medium">
              Ask for help
            </a>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-read text-3xl">Who made Millie</h2>
          <p className="max-w-3xl text-muted-foreground">
            Millie AI was created by <strong className="text-foreground">Adnan Almajdalani</strong> and{" "}
            <strong className="text-foreground">Abdurahman Kannan</strong>. It started as a project for an event called
            Gytex, and the idea first came up in 2021. It has grown into a full app with a website, a Chrome extension,
            and more on the way.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="font-read text-3xl">What Millie can do</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="support" className="space-y-6">
          <h2 className="font-read text-3xl">Support</h2>
          <p className="max-w-2xl text-muted-foreground">
            Stuck, or have a question? Send it here and we'll reply by email.
          </p>
          <SupportForm />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-10 text-center">
          <img src="/simpalicity-logo-white.png" alt="Simpalicity logo" className="h-14 w-auto" />
          <p className="font-medium">MillieAI is owned by Simpalicity</p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Simpalicity. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

const TOPICS = ["General", "Account", "Chat", "Extension", "Billing", "Bug", "Other"] as const;

function SupportForm() {
  const send = useServerFn(submitSupport);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await send({
        data: {
          name: String(form.get("name") ?? "") || undefined,
          email: String(form.get("email") ?? ""),
          topic: String(form.get("topic") ?? "General") as (typeof TOPICS)[number],
          message: String(form.get("message") ?? ""),
        },
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="font-medium">Thanks, your question was sent.</p>
        <p className="text-sm text-muted-foreground">We'll reply to the email you gave us.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="name" placeholder="Your name (optional)" />
        <Input name="email" type="email" placeholder="Email" required />
      </div>
      <select name="topic" className="w-full rounded-md border border-border bg-background p-2 text-sm">
        {TOPICS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <textarea
        name="message"
        rows={5}
        required
        minLength={5}
        placeholder="How can we help?"
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send question"}
      </Button>
    </form>
  );
}
