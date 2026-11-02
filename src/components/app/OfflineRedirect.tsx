import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const LOCAL_PATH = "/localmillie";
const CHECK_EVERY_MS = 5000;
const PROBE_TIMEOUT_MS = 3000;

// Bypass the service worker so this checks the real network, not a cached response.
async function siteReachable(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`/sw.js?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Only redirect when the offline page is already cached on this device.
async function goLocal() {
  // Keep the auth screen available; it explains that authentication needs internet.
  if (window.location.pathname === LOCAL_PATH || window.location.pathname === "/auth") return;
  try {
    if (await caches.match(LOCAL_PATH)) {
      window.location.assign(LOCAL_PATH);
    }
  } catch {
    // Cache Storage may be unavailable.
  }
}

export function OfflineRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let warmed = false;
    let stopped = false;
    let warming = false;

    // Cache the local route, auth route, and assets while the site is reachable.
    const warm = async () => {
      if (warming || stopped) return;
      warming = true;
      try {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 3000);
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => {
                window.clearTimeout(timeout);
                resolve();
              },
              { once: true },
            );
          });
        }

        await fetch(LOCAL_PATH);
        await router.preloadRoute({ to: LOCAL_PATH } as never);
        await router.preloadRoute({ to: "/auth" } as never);

        const files = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter(
            (name) =>
              name.startsWith(window.location.origin) &&
              /\.(js|css|woff2?|png|svg)(\?|$)/.test(name),
          );

        await Promise.all(files.map((file) => fetch(file).catch(() => undefined)));
        warmed = true;
      } catch {
        warmed = false;
      } finally {
        warming = false;
      }
    };

    const check = async () => {
      if (stopped) return;
      if (await siteReachable()) {
        if (!warmed) void warm();
      } else {
        void goLocal();
      }
    };

    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    void check();

    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    const handleConnectivityChange = () => void check();
    window.addEventListener("offline", handleConnectivityChange);
    window.addEventListener("online", handleConnectivityChange);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("offline", handleConnectivityChange);
      window.removeEventListener("online", handleConnectivityChange);
    };
  }, [router]);

  return null;
}
