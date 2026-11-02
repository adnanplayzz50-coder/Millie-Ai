// Millie service worker: network-first, never caches auth or API traffic.
// When the internet is off, any page load is sent to the local Millie page (/LocalMillie).
const CACHE = "millie-v3";
const LOCAL = "/LocalMillie";
const STATIC = /\.(png|svg|css|js|woff2?)$/;

self.addEventListener("install", (event) => {
  // Save the local page right away so it is ready before the first time you go offline.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(LOCAL))
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
  // The connectivity check must always hit the real network.
  if (url.searchParams.has("ping")) return;
  if (
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_serverFn")
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Keep only what the local page needs: its document and the static files.
        if (res.ok && (url.pathname === LOCAL || STATIC.test(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        if (req.mode === "navigate") {
          const local = await caches.match(LOCAL);
          if (local) {
            return url.pathname === LOCAL ? local : Response.redirect(url.origin + LOCAL, 302);
          }
          return Response.error();
        }
        return (await caches.match(req)) || Response.error();
      }),
  );
});
