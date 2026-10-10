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
const GEMINI_MODEL = "gemini-3-flash-preview";
const CURRENT_INFO =
  /\b(news|latest|today|tonight|yesterday|this week|right now|currently|current|price|prices|cost of|stock|score|scores|weather|forecast|election|released|update on|trending|2025|2026)\b/i;

const IMAGE_REQUEST =
  /\b(generate|create|make|draw|paint|design|render|produce)\b[\s\S]{0,40}\b(image|picture|photo|drawing|painting|illustration|logo|wallpaper|artwork|art)\b/i;

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
      headers: { Authorization:
