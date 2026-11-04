import { useSyncExternalStore } from "react";
import { CHAT_PROMPT, CODE_PROMPT } from "./prompts";
import type { WireMessage } from "./chat-client";
import type { Mode } from "./types";

// Local AI means Millie answers with Ollama on the device (or on a computer you point to),
// instead of the online AI. The choice is saved per device, so it is not synced to your account.

export interface LocalAiConfig {
  enabled: boolean;
  host: string;
  model: string;
  visionModel: string;
}

export const LOCAL_DEFAULTS: LocalAiConfig = {
  enabled: false,
  host: "http://localhost:11434",
  model: "qwen3:1.7b",
  visionModel: "gemma3:4b",
};

export const OFFLINE_NOTICE =
  "You're offline, so I can't use the online AI right now. Open **Settings** and turn on **Local** to keep chatting with Ollama on this device.";

const KEY = "millie-local-ai";
let cache: LocalAiConfig | null = null;
const listeners = new Set<() => void>();

function read(): LocalAiConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...LOCAL_DEFAULTS, ...JSON.parse(raw) } : LOCAL_DEFAULTS;
  } catch {
    return LOCAL_DEFAULTS;
  }
}

export function getLocalAi(): LocalAiConfig {
  if (typeof window === "undefined") return LOCAL_DEFAULTS;
  if (!cache) cache = read();
  return cache;
}

export function setLocalAi(patch: Partial<LocalAiConfig>) {
  cache = { ...getLocalAi(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage unavailable: the choice only lasts until the page closes
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLocalAi(): LocalAiConfig {
  return useSyncExternalStore(subscribe, getLocalAi, () => LOCAL_DEFAULTS);
}

export type Platform = "windows" | "mac" | "linux" | "android" | "ios";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/mac/i.test(ua)) return "mac";
  return "linux";
}

function withTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export type OllamaState = "ready" | "blocked" | "unreachable";

/**
 * ready: Ollama answers and lets this site talk to it.
 * blocked: Ollama is running but refuses this site (OLLAMA_ORIGINS needs to include it).
 * unreachable: nothing answers at that address.
 */
export async function probeOllama(host: string): Promise<OllamaState> {
  try {
    const r = await fetch(`${host}/api/tags`, { cache: "no-store", signal: withTimeout(3000) });
    return r.ok ? "ready" : "blocked";
  } catch {
    try {
      // A no-cors request still goes through when only the CORS check is failing.
      await fetch(`${host}/`, { mode: "no-cors", cache: "no-store", signal: withTimeout(3000) });
      return "blocked";
    } catch {
      return "unreachable";
    }
  }
}

export async function listModels(host: string): Promise<string[]> {
  const r = await fetch(`${host}/api/tags`, { cache: "no-store", signal: withTimeout(5000) });
  if (!r.ok) throw new Error(`Ollama returned ${r.status}.`);
  const j = (await r.json()) as { models?: { name: string }[] };
  return (j.models ?? []).map((m) => m.name);
}

export function hasModel(installed: string[], want: string): boolean {
  const full = want.includes(":") ? want : `${want}:latest`;
  return installed.some((n) => n === full);
}

/** Asks Ollama to download a model and reports progress from 0 to 100. */
export async function pullModel(host: string, model: string, onProgress: (pct: number) => void, signal?: AbortSignal) {
  const res = await fetch(`${host}/api/pull`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, name: model, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Couldn't download ${model} (${res.status}).`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as { error?: string; total?: number; completed?: number };
      if (ev.error) throw new Error(ev.error);
      if (ev.total && ev.completed != null) onProgress(Math.round((ev.completed / ev.total) * 100));
    }
  }
}

const stripDataUrl = (u: string) => u.split(",")[1] ?? u;

// Qwen3 can write its reasoning inside <think> tags. Hide it, and hold back a half-written tag.
function visibleText(raw: string): string {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  const open = t.indexOf("<think>");
  if (open >= 0) t = t.slice(0, open);
  const lt = t.lastIndexOf("<");
  if (lt >= 0 && lt > t.length - 9) {
    const tail = t.slice(lt);
    if ("<think>".startsWith(tail) || "</think>".startsWith(tail)) t = t.slice(0, lt);
  }
  return t.replace(/^\s+/, "");
}

/** Streams a reply from Ollama. Same shape as streamChat, so the chat screen can use either. */
export async function streamLocal(
  body: { messages: WireMessage[]; mode: Mode },
  handlers: { onText: (t: string) => void },
  signal?: AbortSignal,
): Promise<void> {
  const cfg = getLocalAi();
  const recent = body.messages.slice(-12);
  const needsVision = recent.some((m) => m.images?.length);
  const model = needsVision ? cfg.visionModel : cfg.model;
  const system = body.mode === "code" ? CODE_PROMPT : CHAT_PROMPT;

  let res: Response;
  try {
    res = await fetch(`${cfg.host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        think: false,
        options: { num_ctx: 4096 },
        messages: [
          { role: "system", content: system },
          ...recent.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.images?.length ? { images: m.images.map(stripDataUrl) } : {}),
          })),
        ],
      }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Can't reach Ollama. Open Settings and check the Local section to finish setup.");
  }

  if (!res.ok || !res.body) {
    let msg = `Ollama returned ${res.status}.`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 404 || /not found/i.test(msg)) {
      throw new Error(
        needsVision
          ? `The image model "${model}" isn't installed. Run: ollama pull ${model}`
          : `The local model "${model}" isn't installed. Open Settings and turn Local on, and it will download.`,
      );
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let raw = "";
  let shown = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (ev.error) throw new Error(ev.error);
      raw += ev.message?.content ?? "";
      const vis = visibleText(raw);
      if (vis.length > shown.length) {
        handlers.onText(vis.slice(shown.length));
        shown = vis;
      }
    }
  }
}

export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String((e as { message?: string } | null)?.message ?? e);
  return e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}