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
  "./assets/modules/data/constants.js",

  // [AUTO_GENERATED_ASSETS]
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

  // [STRATEGY] App Shell for Navigation
  // Nếu là yêu cầu tải trang (HTML), luôn trả về index.html từ cache.
  // Điều này giúp App chạy Offline kể cả khi URL có query params (/?q=...)
  // hoặc khi người dùng refresh trang.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match("./index.html");
          if (cachedResponse) return cachedResponse;
          
          // Fallback nếu chưa cache index.html (lần đầu truy cập)
          return await fetch(request);
        } catch (e) {
          // Fallback cuối cùng nếu cả cache và mạng đều lỗi
          return new Response("Offline", { status: 408 });
        }
      })()
    );
    return;
  }

  // [STRATEGY] Stale-While-Revalidate / Cache First for Assets
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // [FIX] ignoreSearch: true để match được app.js?v=... với app.js trong cache
      const cachedResponse = await cache.match(request, { ignoreSearch: true });
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(request);
        // Chỉ cache các request hợp lệ (http/https), bỏ qua chrome-extension://...
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        return new Response("Offline", { status: 408 });
      }
    })()
  );
});