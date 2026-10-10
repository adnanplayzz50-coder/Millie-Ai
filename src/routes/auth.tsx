import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { PROVIDER_ICONS } from "@/components/ProviderIcons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Millie AI" },
      { name: "description", content: "Sign in to Millie, your calm AI companion for chat and code." },
      { property: "og:title", content: "Sign in — Millie AI" },
      { property: "og:description", content: "Sign in to Millie, your calm AI companion for chat and code." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const nav = useNavigate();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && nav({ to: "/chat", search: {} }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && nav({ to: "/chat", search: {} }));
    return () => data.subscription.unsubscribe();
  }, [nav]);
  const social = async (p: "google" | "apple" | "microsoft") => {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r.error) setMsg(String(r.error.message ?? r.error));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = signup
      ? await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password: pw });
    setMsg(error?.message ?? (signup ? "Check your email to confirm your account." : ""));
  };
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Logo className="mx-auto size-16" />
        <h1 className="font-read text-3xl">Millie</h1>
        <div className="space-y-2">
          {(["google", "apple", "microsoft"] as const).map((p) => {
            const Icon = PROVIDER_ICONS[p];
            return (
              <Button key={p} variant="outline" className="w-full gap-2 capitalize" onClick={() => social(p)}>
                <Icon className="size-4" /> Continue with {p}
              </Button>
            );
          })}
        </div>
        <form onSubmit={submit} className="space-y-2">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required minLength={6} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button className="w-full">{signup ? "Create account" : "Sign in"}</Button>
        </form>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <button className="text-sm text-primary" onClick={() => setSignup(!signup)}>{signup ? "Have an account? Sign in" : "New here? Create an account"}</button>
      </div>
    </div>
  );
}
