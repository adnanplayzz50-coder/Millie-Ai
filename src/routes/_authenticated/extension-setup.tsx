import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Minus, Plus, X } from "lucide-react";
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function ExtensionSetup() {
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const openAt = (i: number) => {
    setZoom(1);
    setOpen(i);
  };
  const close = () => setOpen(null);
  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.5).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.5).toFixed(2)));

  // Keyboard: Escape closes, + and - zoom.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <h1 className="font-read text-3xl tracking-tight">Install the Millie Chrome extension</h1>
          <p className="text-muted-foreground">Five quick steps. Follow them in order. Click a picture to zoom in.</p>
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
              <button
                type="button"
                onClick={() => openAt(i)}
                className="w-full shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-border bg-background sm:w-[360px]"
                aria-label={`Zoom in: ${step.alt}`}
              >
                <img src={step.image} alt={step.alt} className="block w-full object-contain transition-transform hover:scale-[1.01]" />
              </button>
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

      {open !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={STEPS[open].alt}
        >
          <div className="flex items-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
            <span className="mr-auto text-sm text-white/80">Step {open + 1}</span>
            <Button variant="secondary" size="icon" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
              <Minus className="size-4" />
            </Button>
            <span className="w-12 text-center text-sm text-white/80">{Math.round(zoom * 100)}%</span>
            <Button variant="secondary" size="icon" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
              <Plus className="size-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={close} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex min-h-full min-w-full items-center justify-center">
              <img
                src={STEPS[open].image}
                alt={STEPS[open].alt}
                onClick={() => (zoom >= MAX_ZOOM ? setZoom(MIN_ZOOM) : zoomIn())}
                style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none" }}
                className="cursor-zoom-in rounded-lg bg-background transition-[width] duration-200 ease-out"
              />
            </div>
          </div>
          <p className="p-3 text-center text-xs text-white/60">Click the picture or use + and − to zoom. Press Esc to close.</p>
        </div>
      )}
    </div>
  );
}
