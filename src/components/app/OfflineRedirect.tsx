import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const LOCAL_PATH = "/LocalMillie";
const CHECK_EVERY_MS = 5000;
const PROBE_TIMEOUT_MS = 3000;

// True when the Millie site can actually be reached. The "ping" parameter makes the
// service worker skip this request, so it always tests the real network. This also
// catches the case where the device is on Wi-Fi but the internet is down.
async function siteReachable(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`/sw.js?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Sends the visitor to the local Millie page, but only if it is saved for offline use.
// Without that, the browser would show its own "no internet" page instead.
async function goLocal() {
  if (window.location.pathname === LOCAL_PATH) return;
  try {
    if (await caches.match(LOCAL_PATH)) window.location.assign(LOCAL_PATH);
  } catch {
    // Cache storage isn't available here, so there is nothing to fall back to.
  }
}

export function OfflineRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let warmed = false;
    let stopped = false;

    // While online, make sure the local page and the code it needs are saved on this device.
    const warm = async () => {
      try {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
            setTimeout(resolve, 3000);
          });
        }
        await fetch(LOCAL_PATH);
        await router.preloadRoute({ to: LOCAL_PATH } as never);
        const files = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((n) => n.startsWith(window.location.origin) && /\.(js|css|woff2?|png|svg)(\?|$)/.test(n));
        await Promise.all(files.map((f) => fetch(f).catch(() => undefined)));
      } catch {
        // Try again on the next check.
        warmed = false;
      }
    };

    const check = async () => {
      if (stopped) return;
      if (await siteReachable()) {
        if (!warmed) {
          warmed = true;
          warm();
        }
      } else {
        goLocal();
      }
    };

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("offline", check);
    window.addEventListener("online", check);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("offline", check);
      window.removeEventListener("online", check);
    };
  }, [router]);

  return null;
}
