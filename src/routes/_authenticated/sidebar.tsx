import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/ChatView";

/** A compact chat page for the Chrome side panel: chat, screenshots and video calls. */
export const Route = createFileRoute("/_authenticated/sidebar")({
  head: () => ({ meta: [{ title: "Millie side panel — Millie AI" }] }),
  component: function SidePanel() {
    return (
      <div className="h-full min-h-0">
        <ChatView key="side-panel" mode="chat" projectId={null} />
      </div>
    );
  },
});
