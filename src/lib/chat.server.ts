import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CHAT_PROMPT, CODE_PROMPT } from "./prompts";

type Msg = { role: "user" | "assistant"; content: string; images?: string[] };
interface Body {
  messages: Msg[];
  mode: "chat" | "code";
  webSearch?: boolean;
  projectId?: string | null;
  codeModel?: string;
}

/** Coding-only models for C0DE. Each reads its own secret key. "auto" uses the default model. */
const CODE_MODELS: Record<string, { label: string; url: string; keyName: string; model: string; route: string }> = {
  "qwen-coder": {
    label: "Qwen3 Coder",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyName: "OPENROUTER_API_KEY",
    model: "qwen/qwen3-coder:free",
    route: "qwen-coder",
  },
  codestral: {
    label: "Codestral",
    url: "https://codestral.mistral.ai/v1/chat/completions",
    keyName: "CODESTRAL_API_KEY",
    model: "codestral-latest",
    route: "codestral",
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://api.deepseek.com/chat/completions",
    keyName: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    route: "deepseek",
  },
};

const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-3-flash-preview";

const PICTURE_WORD =
  /\b(pictures?|images?|photos?|photographs?|drawings?|paintings?|illustrations?|logos?|wallpapers?|artworks?|sketch(?:es)?|art)\b/i;

/** The words after the picture word become the prompt, e.g. "picture of a cat in space" -> "of a cat in space". */
function picturePrompt(text: string): string | null {
  const m = PICTURE_WORD.exec(text);
  if (!m) return null;
  const after = text.slice(m.index + m[0].length).replace(/^[\s,:-]+/, "").trim();
  return after.length >= 3 ? after : text;
}

/** Free image generation via Cloudflare Workers AI (Flux Schnell). Returns a data URI. */
async function makeImage(prompt: string): Promise<string> {
  const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  if (!account || !token) throw new Error(keyError("CLOUDFLARE_API_TOKEN", "missing account ID or token"));
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 4 }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    console.error("Cloudflare error", res.status, t.slice(0, 300));
    if (res.status === 401 || res.status === 403) {
      throw new Error("Cloudflare rejected the token. Make sure the API token has the Workers AI permission.");
    }
    if (res.status === 429) throw new Error("Today's free image allowance is used up. Try again tomorrow.");
    throw new Error(`Image request failed (${res.status}).`);
  }
  const data = (await res.json()) as { result?: { image?: string } };
  if (!data.result?.image) throw new Error("No image came back. Try a different description.");
  return `data:image/jpeg;base64,${data.result.image}`;
}

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

type Emit = (type: string, value: unknown) => void;

/** Streams a text-only answer from Groq. Used for normal chat, and as the fallback when Gemini is busy. */
async function streamGroq(opts: {
  system: string;
  messages: Msg[];
  body: Body;
  emit: Emit;
  signal: AbortSignal;
  note?: string;
}) {
  const { system, messages, body, emit, signal, note } = opts;
  // A coding-only model, if the user picked one in C0DE.
  const coder =
    body.mode === "code" && body.codeModel && body.codeModel !== "auto" ? CODE_MODELS[body.codeModel] : undefined;
  // Otherwise Lovable's built-in AI is used when its key is set, and Groq is the fallback.
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const key = coder ? process.env[coder.keyName] : lovableKey || process.env["GROQ_API_KEY"];
  if (!key) throw new Error(keyError(coder ? coder.keyName : "LOVABLE_API_KEY", "missing key"));
  if (note) emit("text", note);
  emit("route", coder ? coder.route : lovableKey ? "lovable" : "groq");
  const url = coder
    ? coder.url
    : lovableKey
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";
  const model = coder
    ? coder.model
    : lovableKey
      ? process.env["LOVABLE_MODEL"] || "google/gemini-2.5-flash"
      : GROQ_MODEL;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: body.mode === "code" ? 0.3 : 0.7,
      max_tokens: body.mode === "code" ? 8000 : 4000,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
    signal,
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
  // Google search only runs when the user turns on the globe button. Nothing else uses it automatically.
  const search = !!body.webSearch;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (type, value) => controller.enqueue(enc.encode(JSON.stringify({ type, value }) + "\n"));
      try {
        const imagePrompt = !hasImages && body.mode === "chat" ? picturePrompt(last.content) : null;
        if (imagePrompt) {
          emit("route", "image");
          const src = await makeImage(imagePrompt);
          const alt = imagePrompt.replace(/[\[\]]/g, "").slice(0, 80);
          emit("text", `Here's your picture:\n\n![${alt}](${src})`);
        } else if (hasImages || search) {
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

          // Gemini's free daily quota is used up: answer in text with Groq instead of failing.
          if (res.status === 429) {
            await res.text().catch(() => "");
            await streamGroq({
              system,
              messages,
              body,
              emit,
              signal: request.signal,
              note: hasImages
                ? "(Screen view is busy right now, so I'm answering from your message alone.)\n\n"
                : "(Google search is busy right now, so I'm answering without it.)\n\n",
            });
            return;
          }

          if (!res.ok) {
            const t = await res.text();
            console.error("Gemini error", res.status, t.slice(0, 500));
            if (res.status === 400 && /API key/i.test(t)) throw new Error(keyError("GEMINI_API_KEY", "invalid key"));
            if (res.status === 401 || res.status === 403) throw new Error(keyError("GEMINI_API_KEY", "key rejected"));
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
          await streamGroq({ system, messages, body, emit, signal: request.signal });
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
