import type { User } from "@supabase/supabase-js";

// Supabase keeps the signed-in user in this browser under a key like sb-<project>-auth-token.
// Reading it needs no internet, so Millie can still open when the connection is down.
export function savedUser(): User | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (saved?.user?.id) return saved.user as User;
      }
    }
  } catch {
    // unreadable storage counts as signed out
  }
  return null;
}