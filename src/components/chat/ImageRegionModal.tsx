import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Box = { x: number; y: number; w: number; h: number };

/** Drag a rectangle over an image, then use just that area or the whole image. */
export function ImageRegionModal({ src, onClose, onUse }: { src: string; onClose: () => void; onUse: (dataUrl: string) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pos = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    start.current = p;
    setBox({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = pos(e);
    const s = start.current;
    setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const up = () => {
    start.current = null;
  };

  const useSelected = () => {
    const img = imgRef.current;
    if (!img || !box || box.w < 4 || box.h < 4) return;
    const sx = img.naturalWidth / img.clientWidth;
    const sy = img.naturalHeight / img.clientHeight;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(box.w * sx));
    c.height = Math.max(1, Math.round(box.h * sy));
    c.getContext("2d")!.drawImage(img, box.x * sx, box.y * sy, box.w * sx, box.h * sy, 0, 0, c.width, c.height);
    onUse(c.toDataURL("image/png"));
  };

  const hasSelection = !!box && box.w >= 4 && box.h >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-muted-foreground">Drag a box over the part you want Millie to focus on.</p>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div className="relative w-fit max-w-full select-none touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
            <img ref={imgRef} src={src} alt="Attachment" draggable={false} className="block max-h-[60vh] max-w-full rounded-md" />
            {box && (box.w > 0 || box.h > 0) && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/15"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => onUse(src)}>Use full image</Button>
          <Button onClick={useSelected} disabled={!hasSelection}>Use selected area</Button>
        </div>
      </div>
    </div>
  );
}
