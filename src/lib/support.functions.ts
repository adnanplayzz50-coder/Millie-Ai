import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const SUPPORT_TOPICS = ["General", "Account", "Chat", "Extension", "Billing", "Bug", "Other"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

/** Public: a visitor on /welcome sends a support question. Stored in support_questions. */
export const submitSupport = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        name: z.string().max(80).optional(),
        email: z.string().email().max(200),
        topic: z.enum(SUPPORT_TOPICS).default("General"),
        message: z.string().min(5).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The table's INSERT policy allows anyone to add a question; SELECT is admin-only.
    const { error } = await supabaseAdmin.from("support_questions").insert({
      name: data.name?.trim() || null,
      email: data.email.trim(),
      topic: data.topic,
      message: data.message.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- Admin inbox (used by the /admin/support page) ---------- */

export const adminListSupport = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("support_questions")
    .select("id, name, email, topic, message, resolved, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminSetResolved = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), resolved: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("support_questions")
      .update({ resolved: data.resolved })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
