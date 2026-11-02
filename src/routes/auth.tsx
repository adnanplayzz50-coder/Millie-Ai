import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { PROVIDER_ICONS } from "@/components/ProviderIcons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Millie AI" },
      {
        name: "description",
        content: "Sign in to Millie, your calm AI companion for chat and code.",
      },
      { property: "og:title", content: "Sign in — Millie AI" },
      {
        property: "og:description",
        content: "Sign in to Millie, your calm AI companion for chat and code.",
      },
    ],
  }),
  component: Auth,
});

const AFTER_LOGIN_KEY = "millie-after-login";

function afterLoginPath(): "/localmillie" | "/chat" {
  try {
    return sessionStorage.getItem(AFTER_LOGIN_KEY) === "/localmillie"
      ? "/localmillie"
      : "/chat";
  } catch {
    return "/chat";
  }
}

function Auth() {
  const nav = useNavigate();

  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setMsg(error.message);
        return;
      }
      if (data.session) {
        nav({ to: afterLoginPath(), search: {} });
      }
    }).catch((error: unknown) => {
      if (active) {
        setMsg(error instanceof Error ? error.message : "Could not check your saved session.");
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        nav({ to: afterLoginPath(), search: {} });
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [nav]);

  const social = async (provider: "google" | "apple") => {
    setMsg("");
    if (!navigator.onLine) {
      setMsg("Google and Apple sign-in need the internet.");
      return;
    }
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth` },
      });

      if (error) {
        setMsg(`Could not sign in with ${provider}: ${error.message}`);
        setBusy(false);
      }
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "An unexpected sign-in error occurred.");
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg("");
    if (!navigator.onLine) {
      setMsg("You're offline. Signing in or creating an account needs the internet.");
      return;
    }
    setBusy(true);

    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });

        if (error) {
          setMsg(error.message);
        } else if (data.session) {
          nav({ to: afterLoginPath(), search: {} });
        } else {
          setMsg("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) setMsg(error.message);
      }
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "An unexpected authentication error occurred.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Logo className="mx-auto size-16" />
        <h1 className="font-read text-3xl">Millie</h1>

        <div className="space-y-2">
          {(["google", "apple"] as const).map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            return (
              <Button
                key={provider}
                type="button"
                variant="outline"
                className="w-full gap-2 capitalize"
                disabled={busy || !online}
                onClick={() => social(provider)}
              >
                <Icon className="size-4" />
                Continue with {provider}
              </Button>
            );
          })}
          {!online && (
            <p className="text-xs text-muted-foreground">
              Google and Apple need the internet.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-2">
          <Input
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete={signup ? "new-password" : "current-password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={busy}
          />
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Please wait..." : signup ? "Create account" : "Sign in"}
          </Button>
        </form>

        {msg && (
          <p role="alert" className="text-sm text-muted-foreground">
            {msg}
          </p>
        )}

        <button
          type="button"
          className="text-sm text-primary"
          disabled={busy}
          onClick={() => {
            setSignup(!signup);
            setMsg("");
          }}
        >
          {signup ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
