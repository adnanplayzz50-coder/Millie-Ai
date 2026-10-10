import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/_authenticated/c/$id")({
  head: () => ({ meta: [{ title: "Chat — Millie AI" }] }),
  component: function Conversation() {
    const { id } = Route.useParams();
    const q = useQuery({
      queryKey: ["conversation", id],
      queryFn: async () => (await supabase.from("conversations").select("*").eq("id", id).maybeSingle()).data,
    });
    if (q.isLoading) return null;
    if (!q.data) return <p className="p-8 text-muted-foreground">Chat not found.</p>;
    return <ChatView key={id} conversationId={id} mode={q.data.mode === "code" ? "code" : "chat"} projectId={q.data.project_id} />;
  },
});
