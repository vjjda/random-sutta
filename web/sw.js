// Path: web/sw.js

// [VERSIONING]
const CACHE_NAME = "sutta-cache-dev-placeholder";

console.log(`[SW] Startup (${CACHE_NAME})`);

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css",
  
  // [CHANGED] Trong môi trường Dev (Source), ta dùng file module gốc.
  // Hệ thống Build sẽ tự động thay dòng này thành 'app.bundle.js' khi release.
  "./assets/modules/core/app.js", 
  
  // Icons
  "./assets/icons/favicon.ico",
  "./assets/icons/favicon.svg",
  "./assets/icons/site.webmanifest",
  "./assets/icons/web-app-manifest-192x192.png",
  "./assets/icons/web-app-manifest-512x512.png",
  
  // Fonts
  "./assets/fonts/NotoSans-VariableFont_wdth,wght.ttf",
  "./assets/fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf",

  // Data
  "./assets/db/uid_index.json",
  "./assets/modules/data/constants.js"
];

// ... (Giữ nguyên phần còn lại của file sw.js)
// install, activate, fetch events...
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`[SW] Pre-caching ${SHELL_ASSETS.length} shell items.`);
      return cache.addAll(SHELL_ASSETS).catch(err => {
          console.error("[SW] Pre-cache failed (Check if all files exist):", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  self.clients.claim();
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
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        if (request.mode === "navigate") {
          return cache.match("./index.html");
        }
        return new Response("Offline", { status: 408 });
      }
    })()
  );
});