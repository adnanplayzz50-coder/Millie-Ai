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
  /** C0DE only: which coding model to use. "auto" is the default. */
  codeModel?: string;
}

/** Streams a reply from the server. Events are newline-delimited JSON. */
export async function streamChat(
  body: ChatRequest,
  handlers: { onText: (t: string) => void; onSources?: (s: Source[]) => void; onRoute?: (r: string) => void },
  signal?: AbortSignal,
): Promise<void> {
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
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* ignore */
    }
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
