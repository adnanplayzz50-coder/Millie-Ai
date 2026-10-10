import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (s: Record<string, unknown>): { mode?: "chat" | "code"; project?: string } => ({
    mode: s.mode === "code" ? "code" : undefined,
    project: typeof s.project === "string" ? s.project : undefined,
  }),
  head: () => ({ meta: [{ title: "New chat — Millie AI" }] }),
  component: function NewChat() {
    const { mode, project } = Route.useSearch();
    return <ChatView key={`${mode}-${project}`} mode={mode ?? "chat"} projectId={project} />;
  },
});
