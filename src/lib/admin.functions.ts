/**
 * Callable from anywhere in the app. Every handler loads the server-only
 * admin module itself, so nothing cookie-related ever reaches the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { readAdminSessionState } = await import("./admin.server");
  return readAdminSessionState();
});

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { attemptSignIn } = await import("./admin.server");
    return attemptSignIn(data.password);
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("./admin.server");
  return endAdminSession();
});

/* ---------- Overview ---------- */

export const adminOverview = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, db } = await import("./admin.server");
  await requireAdmin();
  const supabaseAdmin = await db();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [{ count: users }, { count: chatsToday }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", startOfDay.toISOString()),
  ]);
  return { users: users ?? 0, chatsToday: chatsToday ?? 0 };
});

/* ---------- Update log ---------- */

const UpdateInput = z.object({
  id: z.string().uuid().optional(),
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(120),
  body: z.string().max(600),
  sort_order: z.number().int().min(0).max(999).default(0),
});

export const adminListUpdates = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, db } = await import("./admin.server");
  await requireAdmin();
  const supabaseAdmin = await db();
  const { data, error } = await (supabaseAdmin as any)
    .from("update_log")
    .select("*")
    .order("log_date", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminSaveUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./admin.server");
    await requireAdmin();
    const supabaseAdmin = await db();
    const { id, ...row } = data;
    const table = (supabaseAdmin as any).from("update_log");
    const q = id ? table.update(row).eq("id", id) : table.insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./admin.server");
    await requireAdmin();
    const supabaseAdmin = await db();
    const { error } = await (supabaseAdmin as any).from("update_log").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- Site settings: announcement and extension info ---------- */

export const adminGetSettings = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, db } = await import("./admin.server");
  await requireAdmin();
  const supabaseAdmin = await db();
  const { data, error } = await (supabaseAdmin as any).from("site_settings").select("key, value");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
});

export const adminSaveSetting = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ key: z.enum(["announcement", "extension"]), value: z.record(z.string(), z.any()) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./admin.server");
    await requireAdmin();
    const supabaseAdmin = await db();
    const { error } = await (supabaseAdmin as any)
      .from("site_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- Accounts ---------- */

export const adminListAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, db } = await import("./admin.server");
  await requireAdmin();
  const supabaseAdmin = await db();
  const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, display_name");
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  return list.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
    disabled: !!u.banned_until && new Date(u.banned_until).getTime() > Date.now(),
    display_name: names.get(u.id) ?? "",
  }));
});

export const adminUpdateAccount = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        display_name: z.string().max(80).optional(),
        disabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./admin.server");
    await requireAdmin();
    const supabaseAdmin = await db();
    if (data.display_name !== undefined) {
      const { error } = await supabaseAdmin.from("profiles").upsert({ id: data.id, display_name: data.display_name });
      if (error) throw new Error(error.message);
    }
    if (data.disabled !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
        ban_duration: data.disabled ? "876000h" : "none",
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

/** Permanently deletes an account and its sign-in. Cannot be undone. */
export const adminDeleteAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./admin.server");
    await requireAdmin();
    const supabaseAdmin = await db();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- Chrome extension file (stored in the database, sent as a file) ---------- */

export const adminUploadExtension = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        filename: z.string().min(1).max(120),
        version: z.string().max(20),
        base64: z.string().min(1).max(3_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await import("./admin.server");
    await requireAdmin();
    const supabaseAdmin = await db();
    const { error } = await (supabaseAdmin as any).from("extension_files").upsert({
      id: 1,
      filename: data.filename,
      version: data.version,
      content_base64: data.base64,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Public: returns the current extension zip (or null if none uploaded yet). */
export const getExtensionFile = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./admin.server");
  const supabaseAdmin = await db();
  const { data } = await (supabaseAdmin as any)
    .from("extension_files")
    .select("filename, version, content_base64")
    .eq("id", 1)
    .maybeSingle();
  return (data as { filename: string; version: string; content_base64: string } | null) ?? null;
});
