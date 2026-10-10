import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEMORY_PROMPT } from "./prompts";

/** After a conversation turn, extract durable facts with a small Groq call and save them. */
export const extractMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transcript: string }) => ({ transcript: String(input.transcript).slice(-8000) }))
  .handler(async ({ data, context }) => {
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { saved: 0 };
    const { data: existing } = await context.supabase.from("memory_facts").select("fact").limit(200);
    const known = (existing ?? []).map((f) => f.fact);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: MEMORY_PROMPT },
          { role: "user", content: `Already known:\n${known.join("\n") || "(none)"}\n\nConversation:\n${data.transcript}\n\nReturn json.` },
        ],
      }),
    });
    if (!res.ok) return { saved: 0 };
    try {
      const out = JSON.parse((await res.json()).choices[0].message.content) as { facts?: string[] };
      const lower = new Set(known.map((k) => k.toLowerCase()));
      const fresh = (out.facts ?? [])
        .map((f) => String(f).trim())
        .filter((f) => f.length > 3 && f.length < 300 && !lower.has(f.toLowerCase()))
        .slice(0, 5);
      if (fresh.length) {
        await context.supabase.from("memory_facts").insert(fresh.map((fact) => ({ fact, user_id: context.userId })));
      }
      return { saved: fresh.length };
    } catch {
      return { saved: 0 };
    }
  });

/** Permanently deletes the caller's data and account. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    await sb.from("messages").delete().eq("user_id", context.userId);
    await sb.from("conversations").delete().eq("user_id", context.userId);
    await sb.from("project_files").delete().eq("user_id", context.userId);
    await sb.from("projects").delete().eq("user_id", context.userId);
    await sb.from("memory_facts").delete().eq("user_id", context.userId);
    await sb.from("user_settings").delete().eq("user_id", context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
