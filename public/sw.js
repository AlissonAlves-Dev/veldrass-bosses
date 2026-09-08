// Cache offline não mantém o app executando nem agenda notificações push.
const PREFIX = "boss-watch-local-";
const CACHE_NAME = PREFIX + "2026-v1";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./bosses.js", "./app.js", "./manifest.webmanifest", "./icons/portal.svg", "./icons/portal-192.png", "./icons/portal-512.png"];
const allowed = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !allowed.has(event.request.url)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        // Rede primeiro facilita estudar: basta salvar e recarregar.
        const response = await fetch(event.request);
        if (response.ok && response.type === "basic") {
          await cache.put(event.request, response.clone());
          return response;
        }
        return (await cache.match(event.request)) || response;
      } catch {
        return (await cache.match(event.request)) || new Response("Indisponível offline.", { status: 503 });
      }
    })()
  );
});
