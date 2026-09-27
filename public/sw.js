const CACHE_NAME = "cheliv-public-shell-v1";
const SAFE_SHELL = ["/offline", "/icon"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache HTML pages, API replies, portal data, messages, or document
  // downloads. Only static technical assets and the generic offline page are
  // eligible, so install support never creates a private-data copy on a phone.
  const staticAsset = url.pathname.startsWith("/_next/static/") || /\.(?:css|js|woff2?|png|svg|ico)$/i.test(url.pathname);
  if (staticAsset) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
  }
});
