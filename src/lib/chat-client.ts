import { supabase } from "@/integrations/supabase/client";
import type { Mode, Source } from "./types";

export interface WireMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

export interface ChatRequest {
  messages: WireMessage[];
  mode: Mode;
  webSearch?: boolean;
  projectId?: string | null;
  codeModel?: string;
}

type ChatHandlers = { onText: (t: string) => void; onSources?: (s: Source[]) => void; onRoute?: (r: string) => void };

function localSetting(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

async function streamLocalChat(body: ChatRequest, handlers: ChatHandlers, signal?: AbortSignal): Promise<void> {
  const base = localSetting("millie-ollama-url", "http://localhost:11434").trim().replace(/\/$/, "");
  const model = localSetting("millie-ollama-model", "llama3.2").trim() || "llama3.2";
  if (body.webSearch) {
    throw new Error("Google Search grounding is an online feature. Switch Millie to Online mode to use web search.");
  }
  const messages = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.images?.length ? { images: m.images.map((image) => image.replace(/^data:image\/[^;]+;base64,/, "")) } : {}),
  }));
  let response: Response;
  try {
    response = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });
  } catch {
    throw new Error("Cannot connect to local Ollama. Install and start Ollama, download the selected model, and allow this site's origin in OLLAMA_ORIGINS.");
  }
  if (!response.ok || !response.body) {
    let detail = "";
    try { detail = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error("Local Ollama request failed (" + response.status + "). Check the model name and Ollama status. " + detail);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as { message?: { content?: string }; error?: string; done?: boolean };
      if (event.error) throw new Error(event.error);
      if (event.message?.content) handlers.onText(event.message.content);
    }
  }
  if (buffer.trim()) {
    const event = JSON.parse(buffer.trim()) as { message?: { content?: string }; error?: string };
    if (event.error) throw new Error(event.error);
    if (event.message?.content) handlers.onText(event.message.content);
  }
}

/** Streams from local Ollama when selected; otherwise uses the authenticated hosted endpoint. */
export async function streamChat(body: ChatRequest, handlers: ChatHandlers, signal?: AbortSignal): Promise<void> {
  if (localSetting("millie-ai-mode", "online") === "local") {
    return streamLocalChat(body, handlers, signal);
  }

  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status}).`;
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
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
      const ev = JSON.parse(line) as { type: string; value: unknown };
      if (ev.type === "text") handlers.onText(ev.value as string);
      else if (ev.type === "sources") handlers.onSources?.(ev.value as Source[]);
      else if (ev.type === "route") handlers.onRoute?.(ev.value as string);
      else if (ev.type === "error") throw new Error(ev.value as string);
    }
  }
}
