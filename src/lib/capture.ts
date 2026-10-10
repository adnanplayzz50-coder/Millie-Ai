import { resizeImage } from "./attachments";

export type Pt = [number, number]; // percent of the frame, 0..100

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

/** One still frame from a playing video element, or null if nothing is showing yet. */
export async function captureFrom(v: HTMLVideoElement | null): Promise<string | null> {
  if (!v || !v.videoWidth) return null;
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d")!.drawImage(v, 0, 0);
  return resizeImage(c.toDataURL("image/png"), 1600, 0.85);
}

/** Lets the user pick a screen, window or tab, grabs one frame, and stops sharing right away. */
export async function captureScreen(): Promise<string | null> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    await v.play();
    await new Promise((r) => setTimeout(r, 250));
    return await captureFrom(v);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Burns the pen strokes into the frame, and also cuts a close-up of the marked area. */
export async function markedFrame(frozen: string, strokes: Pt[][]) {
  const img = await loadImg(frozen);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.strokeStyle = "#d946ef";
  ctx.lineWidth = Math.max(4, Math.round(w / 180));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let minX = 100, minY = 100, maxX = 0, maxY = 0;
  for (const st of strokes) {
    ctx.beginPath();
    st.forEach(([x, y], i) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      const px = (x / 100) * w;
      const py = (y / 100) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    if (st.length === 1) ctx.lineTo((st[0][0] / 100) * w + 0.1, (st[0][1] / 100) * h);
    ctx.stroke();
  }
  const padX = Math.max(3, (maxX - minX) * 0.15);
  const padY = Math.max(3, (maxY - minY) * 0.15);
  const x0 = (Math.max(0, minX - padX) / 100) * w;
  const y0 = (Math.max(0, minY - padY) / 100) * h;
  const x1 = (Math.min(100, maxX + padX) / 100) * w;
  const y1 = (Math.min(100, maxY + padY) / 100) * h;
  const cw = Math.max(32, Math.round(x1 - x0));
  const ch = Math.max(32, Math.round(y1 - y0));
  const cc = document.createElement("canvas");
  cc.width = cw;
  cc.height = ch;
  cc.getContext("2d")!.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
  return { full: await resizeImage(c.toDataURL("image/png")), close: cc.toDataURL("image/png") };
}
