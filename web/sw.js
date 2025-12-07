// Path: web/sw.js

// [REVERTED] Giữ nguyên placeholder để Release System tự replace
const CACHE_NAME = "sutta-cache-dev-placeholder";

console.log(`[SW] Startup (${CACHE_NAME})`);

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css",
  
  // Entry point chính
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

// ... (Các phần logic install, activate, fetch giữ nguyên không đổi) ...
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
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
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        if (request.mode === "navigate") return cache.match("./index.html");
        return new Response("Offline", { status: 408 });
      }
    })()
  );
});