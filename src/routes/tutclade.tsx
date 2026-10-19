import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tutclade")({
  head: () => ({
    meta: [
      { title: "Tutclade — Millie AI" },
      { name: "description", content: "Tutclade: a public Millie AI page, open to everyone without signing in." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Tutclade — Millie AI" },
      { property: "og:description", content: "A public Millie AI page, open to everyone without signing in." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tutclade,
});

function Tutclade() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
      <Logo className="h-20 w-20 text-primary" />
      <h1 className="font-serif text-4xl">Tutclade</h1>
      <p className="max-w-md text-muted-foreground">
        Welcome! This page is open to everyone — no sign-in needed.
      </p>
      <Button asChild>
        <Link to="/welcome">Learn about Millie</Link>
      </Button>
    </div>
  );
}
