import { createFileRoute } from "@tanstack/react-router";

// Streaming chat endpoint. The handler verifies the caller's session token itself.
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChat } = await import("@/lib/chat.server");
        return handleChat(request);
      },
    },
  },
});
