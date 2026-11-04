import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

// Saves Millie on this device so the app still opens with no internet.
// It registers the service worker, then (while online) stores the main pages and their code.
export function OfflineReady() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let warmed = false;

    const warm = async () => {
      if (warmed || !navigator.onLine) return;
      warmed = true;
      try {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
            setTimeout(resolve, 3000);
          });
        }
        await fetch("/chat");
        await router.preloadRoute({ to: "/chat" } as never);
        const files = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((n) => n.startsWith(window.location.origin) && /\.(js|css|woff2?|png|svg)(\?|$)/.test(n));
        await Promise.all(files.map((f) => fetch(f).catch(() => undefined)));
      } catch {
        // Try again after the next page change or when the connection returns.
        warmed = false;
      }
    };

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    void warm();
    const unsubscribe = router.subscribe("onResolved", () => void warm());
    window.addEventListener("online", warm);
    return () => {
      unsubscribe();
      window.removeEventListener("online", warm);
    };
  }, [router]);

  return null;
}