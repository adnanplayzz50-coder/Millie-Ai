import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/extension-setup")({
  head: () => ({ meta: [{ title: "Install the Millie Chrome extension — Millie AI" }] }),
  component: ExtensionSetup,
});

const STEPS = [
  {
    image: "/setup/step-1-zip.png",
    alt: "The downloaded zip file",
    text: "Unzip the file.",
  },
  {
    image: "/setup/step-2-unzipped.png",
    alt: "The unzipped folder",
    text: "It should look like this.",
  },
  {
    image: "/setup/step-3-developer.png",
    alt: "The Chrome extensions page with Developer mode turned on",
    text: "Go to your Chrome extensions and turn on developer mode.",
  },
  {
    image: "/setup/step-4-load.png",
    alt: "The Load unpacked button",
    text: "After turning developer mode on, you should see a button that says Load unpacked. Click on it.",
  },
  {
    image: "/setup/step-5-select.png",
    alt: "The folder picker",
    text: "Click on the unzipped folder you made, and your Chrome extension should be ready.",
  },
];

function ExtensionSetup() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <h1 className="font-read text-3xl tracking-tight">Install the Millie Chrome extension</h1>
          <p className="text-muted-foreground">Five quick steps. Follow them in order.</p>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <a href="/millie-extension.zip" download="millie-extension.zip">
                <Download className="size-4" /> Download again
              </a>
            </Button>
          </div>
        </header>

        <ol className="space-y-6">
          {STEPS.map((step, i) => (
            <li
              key={step.image}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5"
            >
              <img
                src={step.image}
                alt={step.alt}
                className="w-full shrink-0 rounded-xl border border-border bg-background object-contain sm:w-[360px]"
              />
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {i + 1}
                </span>
                <p className="leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <span>Once it's loaded, click the Millie icon in Chrome's toolbar to open it.</span>
          <Link to="/chat" search={{}} className="text-primary underline">
            Back to Millie
          </Link>
        </div>
      </div>
    </div>
  );
}
