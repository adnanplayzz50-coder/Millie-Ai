import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/chat" : "/auth", search: {} });
  },
});
