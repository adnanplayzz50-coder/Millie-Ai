import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { savedUser } from "@/lib/offline-session";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // No internet: use the sign-in saved in this browser so Millie still opens.
    if (!navigator.onLine) {
      const saved = savedUser();
      if (saved) return { user: saved };
      throw redirect({ to: "/auth" });
    }
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };
    // A network failure (Wi-Fi up, internet down) is not the same as being signed out.
    const networkDown = error?.name === "AuthRetryableFetchError" || /fetch|network/i.test(error?.message ?? "");
    const saved = networkDown ? savedUser() : null;
    if (saved) return { user: saved };
    throw redirect({ to: "/auth" });
  },
  component: function Gate() {
    const { user } = Route.useRouteContext();
    return <AppShell user={user} />;
  },
});