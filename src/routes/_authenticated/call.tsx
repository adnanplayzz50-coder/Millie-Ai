import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/call")({
  head: () => ({ meta: [{ title: "Video call — Millie AI" }] }),
  component: () => (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-read text-3xl">Video call with Millie</h1>
      <p className="text-muted-foreground">Coming in the next update.</p>
      <Link to="/chat" search={{}} className="text-primary">Back to chat</Link>
    </div>
  ),
});
