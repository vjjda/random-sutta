// Path: web/sw.js

// Tên cache mới (Nên bump version khi deploy)
const CACHE_NAME = "sutta-reader-cache-v1.1.0";

const SUTTA_DATA_FILES = [
  "an.js",
  "dn.js",
  "kn/bv.js",
  "kn/cnd.js",
  "kn/cp.js",
  "kn/dhp.js",
  "kn/iti.js",
  "kn/ja.js",
  "kn/kp.js",
  "kn/mil.js",
  "kn/mnd.js",
  "kn/ne.js",
  "kn/pe.js",
  "kn/ps.js",
  "kn/pv.js",
  "kn/snp.js",
  "kn/tha-ap.js",
  "kn/thag.js",
  "kn/thi-ap.js",
  "kn/thig.js",
  "kn/ud.js",
  "kn/vv.js",
  "mn.js",
  "sn.js",
].map((file) => `./assets/sutta/books/${file}`);

// REMOVED: const NAME_DATA_FILES = ...

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/modules/constants.js",
  "./assets/modules/utils.js",
  "./assets/modules/filters.js",
  "./assets/modules/renderer.js",
  "./assets/sutta/sutta_loader.js",
  // REMOVED: "./assets/sutta/name_loader.js",
  "./assets/icons/favicon-96x96.png",
  "./assets/icons/favicon.svg",
  "./assets/icons/favicon.ico",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/site.webmanifest",
  "./assets/icons/web-app-manifest-192x192.png",
  "./assets/icons/web-app-manifest-512x512.png",
];

// Combine files
const ALL_ASSETS = CORE_ASSETS.concat(SUTTA_DATA_FILES);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching ALL assets for offline use...");
      return cache.addAll(ALL_ASSETS);
    })
  );
});

// Activate và Fetch logic giữ nguyên
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request, {
        ignoreSearch: true,
      });
      if (cachedResponse) return cachedResponse;
      if (event.request.mode === "navigate") {
        const indexResponse = await caches.match("./index.html");
        if (indexResponse) return indexResponse;
      }
      try {
        const networkResponse = await fetch(event.request);
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseToCache = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, responseToCache);
        }
        return networkResponse;
      } catch (error) {
        return new Response("Offline - Resource not found", {
          status: 404,
          statusText: "Not Found",
        });
      }
    })()
  );
});