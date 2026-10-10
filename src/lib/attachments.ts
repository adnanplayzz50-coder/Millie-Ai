import { uid, type Attachment } from "./types";

const MAX_TEXT = 200_000;
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|tar|rar|7z|exe|dll|so|dylib|bin|mp3|mp4|mov|avi|wav|ogg|woff2?|ttf|otf|eot|psd|class|jar|wasm|lock|sqlite|db)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|\.cache|__pycache__|\.venv)(\/|$)/;

export function resizeImage(dataUrl: string, max = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

const readAsDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export async function imageFromFile(f: File): Promise<Attachment> {
  return { id: uid(), kind: "image", name: f.name || "image.png", dataUrl: await resizeImage(await readAsDataUrl(f)) };
}

export async function textFromFile(f: File, name = f.name): Promise<Attachment | null> {
  if (BINARY_EXT.test(name) || f.size > MAX_TEXT) return null;
  const text = await f.text();
  if (text.includes("\u0000")) return null;
  return { id: uid(), kind: "text", name, text };
}

export async function filesToAttachments(files: FileList | File[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const f of Array.from(files)) {
    if (f.type.startsWith("image/")) out.push(await imageFromFile(f));
    else {
      const a = await textFromFile(f);
      if (a) out.push(a);
    }
  }
  return out;
}

/** Folder picker: one combined text attachment with every readable text/code file. */
export async function folderToAttachment(files: FileList): Promise<Attachment | null> {
  const parts: string[] = [];
  let root = "folder";
  let total = 0;
  for (const f of Array.from(files)) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    root = path.split("/")[0] || root;
    if (SKIP_DIR.test(path)) continue;
    const a = await textFromFile(f, path);
    if (!a?.text) continue;
    if (total + a.text.length > 400_000) break;
    total += a.text.length;
    parts.push(`--- ${path} ---\n${a.text}`);
  }
  if (!parts.length) return null;
  return { id: uid(), kind: "text", name: `${root}/ (${parts.length} files)`, text: parts.join("\n\n") };
}

export async function captureScreenshot(): Promise<Attachment> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 250));
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")!.drawImage(video, 0, 0);
    return { id: uid(), kind: "image", name: "screenshot.jpg", dataUrl: await resizeImage(c.toDataURL("image/png")) };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Builds the hidden context block for text attachments. */
export function contextFromAttachments(atts: Attachment[]) {
  return atts
    .filter((a) => a.kind === "text" && a.text)
    .map((a) => `<attached_file name="${a.name}">\n${a.text}\n</attached_file>`)
    .join("\n\n");
}
