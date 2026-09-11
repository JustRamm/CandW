const CACHE_NAME = "ooh-sync-cache-v1";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/brand/logo.svg",
  "/brand/favicon.svg",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
];

// Install event — precache core app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Pre-caching failed (non-blocking):", err);
      })
  );
});

// Activate event — clean up legacy caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch event handler with stale-while-revalidate for assets and network-first for navigation
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore chrome-extension or unsupported schemes
  if (!url.protocol.startsWith("http")) return;

  // For Supabase API or storage requests, use network-first with graceful offline fallback
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/storage/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ offline: true, error: "Network unavailable. Operating in Offline Field Mode." }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // For HTML navigation requests, use network-first falling back to cached index.html (SPA support)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match("/index.html").then((res) => res || caches.match("/"));
        })
    );
    return;
  }

  // For static assets (JS, CSS, fonts, images), use cache-first with network fallback
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ttf|json|ico)$/) ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Refresh cache in background (Stale While Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback for broken images if offline
            if (request.destination === "image") {
              return caches.match("/brand/favicon.svg");
            }
            return new Response("", { status: 408, statusText: "Offline" });
          });
      })
    );
  }
});

// Listen for skip waiting messages from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
