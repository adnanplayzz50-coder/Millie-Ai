// Millie service worker: network-first, never caches auth or API traffic.
// It keeps the app pages and their code so Millie still opens with no internet.
const CACHE = "millie-v5";
const STATIC = /\.(png|svg|css|js|woff2?|ico|webmanifest)$/;
// Pages worth saving. Any other page opened offline falls back to the saved chat page.
const PAGES = ["/", "/chat", "/auth", "/welcome"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add("/chat"))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.searchParams.has("ping")) return;
  if (
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_serverFn")
  ) {
    return;
  }

  const isPage = req.mode === "navigate";
  if (!isPage && !STATIC.test(url.pathname) && !PAGES.includes(url.pathname)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (STATIC.test(url.pathname) || PAGES.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const exact = await caches.match(req);
        if (exact) return exact;
        if (isPage) {
          return (await caches.match("/chat")) || (await caches.match("/")) || Response.error();
        }
        return Response.error();
      }),
  );
});