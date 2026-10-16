import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const COOKIE = "millie_admin";
const SESSION_MS = 8 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

// Constant-time compare of equal-length hex digests.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function readCookie(name: string) {
  const raw = getRequestHeader("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function isValidSession(secret: string) {
  const value = readCookie(COOKIE);
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, `admin:${exp}`));
}

/** Every admin action calls this first. Throws if the admin isn't signed in. */
export async function requireAdmin() {
  const secret = process.env["ADMIN_SESSION_SECRET"];
  if (!secret || !(await isValidSession(secret))) throw new Error("Not signed in as admin.");
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const secret = process.env["ADMIN_SESSION_SECRET"];
  const configured = !!process.env["ADMIN_PASSWORD"];
  if (!secret) return { signedIn: false, configured };
  return { signedIn: await isValidSession(secret), configured };
});

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    const secret = process.env["ADMIN_SESSION_SECRET"];
    if (!expected || !secret) {
      return { ok: false as const, error: "Admin password isn't set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Project Settings → Secrets." };
    }
    const supabaseAdmin = await db();
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const visitor = await hmac(secret, `visitor:${ip}`);
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const { count } = await supabaseAdmin
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("visitor_hash", visitor)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_ATTEMPTS) {
      return { ok: false as const, error: "Too many wrong passwords. Please wait 15 minutes and try again." };
    }
    const match = safeEqual(await hmac(secret, data.password), await hmac(secret, expected));
    if (!match) {
      await supabaseAdmin.from("admin_login_attempts").insert({ visitor_hash: visitor });
      return { ok: false as const, error: "Wrong password." };
    }
    await supabaseAdmin.from("admin_login_attempts").delete().eq("visitor_hash", visitor);
    const exp = Date.now() + SESSION_MS;
    const token = `${exp}.${await hmac(secret, `admin:${exp}`)}`;
    setResponseHeader(
      "Set-Cookie",
      `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`,
    );
    return { ok: true as const };
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return { ok: true };
});

/* ---------- Overview ---------- */

export const adminOverview = createServerFn({ method: "POST" }).handler(async () => {
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
  await requireAdmin();
  const supabaseAdmin = await db();
  const { data, error } = await (supabaseAdmin as any).from("update_log")
    .select("*")
    .order("log_date", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminSaveUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data }) => {
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
    await requireAdmin();
    const supabaseAdmin = await db();
    const { error } = await (supabaseAdmin as any).from("update_log").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- Site settings: announcement and extension info ---------- */

export const adminGetSettings = createServerFn({ method: "POST" }).handler(async () => {
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
    await requireAdmin();
    const supabaseAdmin = await db();
    const { error } = await (supabaseAdmin as any).from("site_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- Accounts ---------- */

export const adminListAccounts = createServerFn({ method: "POST" }).handler(async () => {
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
  const supabaseAdmin = await db();
  const { data } = await (supabaseAdmin as any)
    .from("extension_files")
    .select("filename, version, content_base64")
    .eq("id", 1)
    .maybeSingle();
  return (data as { filename: string; version: string; content_base64: string } | null) ?? null;
});
