import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { savedUser } from "@/lib/offline-session";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Millie AI — chat and code companion" },
      { name: "description", content: "Millie is a calm, capable AI companion for conversation and coding." },
      { property: "og:title", content: "Millie AI" },
      { property: "og:description", content: "A calm, capable AI companion for conversation and coding." },
    ],
  }),
  beforeLoad: async () => {
    let signedIn: boolean;
    if (!navigator.onLine) {
      // No internet: the sign-in saved in this browser still counts.
      signedIn = !!savedUser();
    } else {
      const { data, error } = await supabase.auth.getSession();
      // An error here usually means the network failed while refreshing, not that you signed out.
      signedIn = !!data.session || (!!error && !!savedUser());
    }
    throw redirect({ to: signedIn ? "/chat" : "/auth", search: {} });
  },
});
