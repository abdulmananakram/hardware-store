const CACHE = "hardware-shop-shell-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/logo.svg", "/fonts/NotoNaskhArabic.ttf"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const response = await fetch("/");
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\/_next\/static\/[^"]+)"/g)].map((match) => match[1]);
    await cache.addAll([...new Set(assets)]);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match("/"));
    })
  );
});
