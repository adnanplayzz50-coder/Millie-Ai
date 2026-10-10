import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CHAT_PROMPT, CODE_PROMPT } from "./prompts";

type Msg = { role: "user" | "assistant"; content: string; images?: string[] };
interface Body {
  messages: Msg[];
  mode: "chat" | "code";
  webSearch?: boolean;
  projectId?: string | null;
}

const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-2.5-flash";
const CURRENT_INFO =
  /\b(news|latest|today|tonight|yesterday|this week|right now|currently|current|price|prices|cost of|stock|score|scores|weather|forecast|election|released|update on|trending|2025|2026)\b/i;

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function keyError(name: string, detail?: string) {
  return `Millie can't reach the AI service${detail ? ` (${detail})` : ""}. Add or check the ${name} secret in Project Settings → Secrets.`;
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);

async function buildSystem(sb: ReturnType<typeof userClient>, userId: string, body: Body, lastUser: string) {
  const parts = [body.mode === "code" ? CODE_PROMPT : CHAT_PROMPT];
  parts.push(`Today's date: ${new Date().toDateString()}.`);

  const [{ data: profile }, { data: facts }] = await Promise.all([
    sb.from("profiles").select("display_name, hobbies, interests, ai_use").eq("id", userId).maybeSingle(),
    sb.from("memory_facts").select("fact").order("created_at", { ascending: false }).limit(200),
  ]);
  if (profile) {
    const p = [
      profile.display_name && `Name: ${profile.display_name}`,
      profile.hobbies && `Hobbies: ${profile.hobbies}`,
      profile.interests && `Interests: ${profile.interests}`,
      profile.ai_use && `Uses AI for: ${profile.ai_use}`,
    ].filter(Boolean);
    if (p.length) parts.push(`About the user (use lightly for personalization):\n${p.join("\n")}`);
  }
  if (facts?.length) {
    const q = words(lastUser);
    const scored = facts
      .map((f) => ({ f: f.fact, s: [...words(f.fact)].filter((w) => q.has(w)).length }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
    if (scored.length) parts.push(`Relevant things you remember about the user:\n- ${scored.map((x) => x.f).join("\n- ")}`);
  }
  if (body.projectId) {
    const [{ data: proj }, { data: files }] = await Promise.all([
      sb.from("projects").select("name, description, instructions").eq("id", body.projectId).maybeSingle(),
      sb.from("project_files").select("path, content").eq("project_id", body.projectId),
    ]);
    if (proj) {
      parts.push(`This chat belongs to the project "${proj.name}". ${proj.description}`);
      if (proj.instructions) parts.push(`Project instructions (follow them):\n${proj.instructions}`);
      let budget = 60_000;
      const kb: string[] = [];
      for (const f of files ?? []) {
        if (budget <= 0) break;
        const c = f.content.slice(0, budget);
        budget -= c.length;
        kb.push(`<knowledge_file path="${f.path}">\n${c}\n</knowledge_file>`);
      }
      if (kb.length) parts.push(`Project knowledge files:\n${kb.join("\n\n")}`);
    }
  }
  return parts.join("\n\n");
}

function splitDataUrl(d: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(d);
  return m ? { mime_type: m[1], data: m[2] } : null;
}

function geminiContents(messages: Msg[]) {
  return messages.map((m, i) => {
    const parts: unknown[] = [{ text: m.content || "(see image)" }];
    if (i === messages.length - 1 && m.images) {
      for (const img of m.images) {
        const s = splitDataUrl(img);
        if (s) parts.push({ inline_data: s });
      }
    }
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
}

async function* sseLines(res: Response) {
  const reader = res.body!.getReader();
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
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

export async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in again." }, 401);
  const sb = userClient(token);
  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: "Your session expired. Please sign in again." }, 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const messages = (body.messages ?? []).slice(-30);
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json({ error: "No message." }, 400);

  const system = await buildSystem(sb, userData.user.id, body, last.content);
  const hasImages = !!last.images?.length;
  const search = !!body.webSearch || (body.mode === "chat" && CURRENT_INFO.test(last.content));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (type: string, value: unknown) => controller.enqueue(enc.encode(JSON.stringify({ type, value }) + "\n"));
      try {
        if (hasImages || search) {
          const key = process.env["GEMINI_API_KEY"];
          if (!key) throw new Error(keyError("GEMINI_API_KEY", "missing key"));
          emit("route", search ? "search" : "vision");
          const payload: Record<string, unknown> = {
            systemInstruction: { parts: [{ text: system }] },
            contents: geminiContents(messages),
          };
          if (search) payload.tools = [{ google_search: {} }];
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
            {
              method: "POST",
              headers: { "content-type": "application/json", "x-goog-api-key": key },
              body: JSON.stringify(payload),
              signal: request.signal,
            },
          );
          if (!res.ok) {
            const t = await res.text();
            console.error("Gemini error", res.status, t.slice(0, 500));
            if (res.status === 400 && /API key/i.test(t)) throw new Error(keyError("GEMINI_API_KEY", "invalid key"));
            if (res.status === 401 || res.status === 403) throw new Error(keyError("GEMINI_API_KEY", "key rejected"));
            if (res.status === 429) throw new Error("Gemini's free-tier rate limit was reached. Please wait a minute and try again.");
            throw new Error(`Gemini request failed (${res.status}). Check the GEMINI_API_KEY secret in Project Settings → Secrets.`);
          }
          const sources = new Map<string, string>();
          for await (const data of sseLines(res)) {
            const ev = JSON.parse(data);
            const cand = ev.candidates?.[0];
            for (const p of cand?.content?.parts ?? []) if (p.text) emit("text", p.text);
            for (const ch of cand?.groundingMetadata?.groundingChunks ?? []) {
              if (ch.web?.uri) sources.set(ch.web.uri, ch.web.title || ch.web.uri);
            }
          }
          if (sources.size) emit("sources", [...sources].map(([uri, title]) => ({ uri, title })));
        } else {
          const key = process.env["GROQ_API_KEY"];
          if (!key) throw new Error(keyError("GROQ_API_KEY", "missing key"));
          emit("route", "groq");
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: GROQ_MODEL,
              stream: true,
              temperature: body.mode === "code" ? 0.3 : 0.7,
              max_tokens: body.mode === "code" ? 8000 : 4000,
              messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
            }),
            signal: request.signal,
          });
          if (!res.ok) {
            const t = await res.text();
            console.error("Groq error", res.status, t.slice(0, 500));
            if (res.status === 401 || res.status === 403) throw new Error(keyError("GROQ_API_KEY", "key rejected"));
            if (res.status === 429) throw new Error("Groq's free-tier rate limit was reached. Please wait a moment and try again.");
            if (res.status === 413) throw new Error("That message is too large for the free Groq tier. Try attaching fewer or smaller files.");
            throw new Error(`Groq request failed (${res.status}). Check the GROQ_API_KEY secret in Project Settings → Secrets.`);
          }
          for await (const data of sseLines(res)) {
            if (data === "[DONE]") break;
            const t = JSON.parse(data).choices?.[0]?.delta?.content;
            if (t) emit("text", t);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") emit("error", (e as Error).message || "Something went wrong.");
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache, no-transform" },
  });
}
