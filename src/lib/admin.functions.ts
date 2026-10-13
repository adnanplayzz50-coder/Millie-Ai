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
      return { ok: false as const, error: "Admin password isn't set up yet. Add ADMIN_PASSWORD in Project Settings → Secrets." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      if ((count ?? 0) + 1 >= MAX_ATTEMPTS) {
        return { ok: false as const, error: "Wrong password. Too many attempts — sign-in is blocked for 15 minutes." };
      }
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
