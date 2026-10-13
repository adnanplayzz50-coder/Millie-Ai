/** Client-side file generation (Word, PowerPoint, PDF, poster). Nothing is uploaded. */
export type FileKind = "docx" | "pptx" | "pdf" | "png";

const PURPLE = "7C3AED";
const DARK = "2E1065";
const LIGHT = "F5F3FF";
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_CHARS = 200_000;

const FILE_RE = /^\/file\b|\b(word doc(ument)?|\.docx|docx|power ?point|pptx|slides?|slide ?deck|presentation|pdf|poster|flyer|document)\b/i;
export const isFileRequest = (t: string) => FILE_RE.test(t);
export const FILE_HINT =
  "(The user wants a file. Write the full content as clean Markdown: a # title, ## section headings, short paragraphs and bullet lists. The app turns it into a downloadable file — do not say you cannot create files. Refuse harmful content.)";

export interface Section {
  heading: string;
  paras: string[];
  bullets: string[];
}
export interface Doc {
  title: string;
  sections: Section[];
}

const clean = (s: string) =>
  s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();

export function parseDoc(md: string): Doc {
  const text = md.replace(/```[\s\S]*?```/g, "").slice(0, MAX_CHARS);
  let title = "";
  const sections: Section[] = [];
  let cur: Section | null = null;
  const ensure = () => (cur ??= (sections.push({ heading: "", paras: [], bullets: [] }), sections[sections.length - 1]));
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      const t = clean(h[2]);
      if (h[1].length === 1 && !title) title = t;
      else {
        cur = { heading: t, paras: [], bullets: [] };
        sections.push(cur);
      }
      continue;
    }
    const b = line.match(/^([-*+]|\d+[.)])\s+(.*)/);
    if (b) ensure().bullets.push(clean(b[2]));
    else if (!line.startsWith("|")) ensure().paras.push(clean(line));
  }
  const kept = sections.filter((s) => s.heading || s.paras.length || s.bullets.length);
  if (!title) title = kept[0]?.heading || "Millie document";
  return { title, sections: kept };
}

export function safeName(title: string, ext: FileKind) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "millie-file";
  return `${base}.${ext}`;
}

let logoCache: string | null = null;
async function logoPng(size = 256): Promise<string> {
  if (logoCache) return logoCache;
  const img = new Image();
  img.src = "/favicon.svg";
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(img, 0, 0, size, size);
  return (logoCache = c.toDataURL("image/png"));
}

async function docx(d: Doc): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, ImageRun, TextRun, AlignmentType } = await import("docx");
  const logo = await logoPng();
  const bytes = Uint8Array.from(atob(logo.split(",")[1]), (c) => c.charCodeAt(0));
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: bytes, transformation: { width: 80, height: 80 }, type: "png" })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: d.title, color: PURPLE, bold: true })] }),
  ];
  for (const s of d.sections) {
    if (s.heading) children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: s.heading, color: DARK })] }));
    for (const p of s.paras) children.push(new Paragraph({ children: [new TextRun(p)], spacing: { after: 120 } }));
    for (const b of s.bullets) children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
  }
  return Packer.toBlob(new Document({ creator: "Millie AI", title: d.title, sections: [{ children }] }));
}

async function pptx(d: Doc): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  const logo = await logoPng();
  const t = p.addSlide();
  t.background = { color: DARK };
  t.addImage({ data: logo, x: 5.92, y: 1.0, w: 1.5, h: 1.5 });
  t.addText(d.title, { x: 0.6, y: 2.9, w: 12.1, h: 1.4, fontSize: 44, bold: true, color: "FFFFFF", align: "center", fontFace: "Georgia" });
  t.addText("Made with Millie AI", { x: 0.6, y: 4.4, w: 12.1, h: 0.5, fontSize: 18, color: "C4B5FD", align: "center" });
  for (const s of d.sections) {
    const pts = [...s.bullets, ...s.paras].map((x) => (x.length > 140 ? x.slice(0, 137) + "…" : x));
    for (let i = 0; i < Math.max(1, pts.length); i += 6) {
      const sl = p.addSlide();
      sl.background = { color: LIGHT };
      sl.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PURPLE } });
      sl.addText(s.heading || d.title, { x: 0.7, y: 0.4, w: 12, h: 1, fontSize: 36, bold: true, color: DARK, fontFace: "Georgia" });
      const chunk = pts.slice(i, i + 6);
      if (chunk.length)
        sl.addText(chunk.map((x) => ({ text: x, options: { bullet: true, breakLine: true } })), { x: 0.7, y: 1.6, w: 12, h: 5.4, fontSize: 22, color: "1F1F2E", valign: "top", paraSpaceAfter: 10 });
    }
  }
  return (await p.write({ outputType: "blob" })) as Blob;
}

async function pdf(d: Doc): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 56;
  doc.setFillColor(46, 16, 101);
  doc.rect(0, 0, W, 170, "F");
  doc.addImage(await logoPng(), "PNG", W / 2 - 30, 24, 60, 60);
  doc.setTextColor(255, 255, 255).setFont("times", "bold").setFontSize(26);
  doc.text(doc.splitTextToSize(d.title, W - 2 * M), W / 2, 118, { align: "center" });
  let y = 210;
  const write = (txt: string, size: number, style: string, color: [number, number, number], indent = 0, gap = 6) => {
    doc.setFont(style === "h" ? "times" : "helvetica", style === "h" ? "bold" : "normal").setFontSize(size).setTextColor(...color);
    for (const l of doc.splitTextToSize(txt, W - 2 * M - indent)) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(l, M + indent, y);
      y += size * 1.35;
    }
    y += gap;
  };
  for (const s of d.sections) {
    if (s.heading) { y += 8; write(s.heading, 17, "h", [124, 58, 237]); }
    for (const p of s.paras) write(p, 11, "b", [30, 30, 46]);
    for (const b of s.bullets) write(`•  ${b}`, 11, "b", [30, 30, 46], 10, 2);
  }
  return doc.output("blob");
}

async function poster(d: Doc): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#2E1065"); grad.addColorStop(1, "#7C3AED");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.beginPath(); g.arc(W - 120, 160, 260, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(80, H - 120, 200, 0, Math.PI * 2); g.fill();
  const logo = new Image(); logo.src = await logoPng(); await logo.decode();
  g.drawImage(logo, W / 2 - 70, 90, 140, 140);
  const wrap = (txt: string, font: string, max: number, y: number, lh: number, color: string, maxLines = 4) => {
    g.font = font; g.fillStyle = color; g.textAlign = "center";
    const words = txt.split(/\s+/); let line = ""; let n = 0;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > max && line) { g.fillText(line, W / 2, y); y += lh; line = w; if (++n >= maxLines) return y; }
      else line = test;
    }
    if (line) { g.fillText(line, W / 2, y); y += lh; }
    return y;
  };
  let y = wrap(d.title.toUpperCase(), "bold 92px Georgia, serif", W - 140, 360, 100, "#FFFFFF", 3);
  g.fillStyle = "#C4B5FD"; g.fillRect(W / 2 - 80, y, 160, 6); y += 80;
  const lines = d.sections.flatMap((s) => [s.heading, ...s.bullets, ...s.paras]).filter(Boolean).slice(0, 5);
  for (const l of lines) y = wrap(l, "40px sans-serif", W - 200, y, 52, "#EDE9FE", 2) + 18;
  g.font = "28px sans-serif"; g.fillStyle = "rgba(255,255,255,0.6)"; g.fillText("Made with Millie AI", W / 2, H - 60);
  return new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error("Could not draw the poster."))), "image/png"));
}

export async function buildFile(kind: FileKind, md: string): Promise<{ blob: Blob; name: string }> {
  const d = parseDoc(md);
  if (!d.sections.length && !d.title) throw new Error("There's no content to put in the file yet.");
  const blob = await { docx, pptx, pdf, png: poster }[kind](d);
  if (blob.size > MAX_BYTES) throw new Error(`This file is too large (${(blob.size / 1048576).toFixed(1)} MB). Try shorter content.`);
  return { blob, name: safeName(d.title, kind) };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
