// Path: web/sw.js

// [IMPORTANT] Giữ nguyên placeholder này để Release System tự động replace bằng version tag thật
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
  "./assets/fonts/NotoSans-Regular.ttf",
  "./assets/fonts/NotoSans-Italic.ttf",

  // Data
  "./assets/modules/data/constants.js",

  // [AUTO_GENERATED_ASSETS]
];

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

  // [STRATEGY 1] App Shell for Navigation (Fix Refresh Issue)
  // Xử lý request điều hướng (Refresh, nhập URL)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          
          // 1. Cố gắng tìm index.html trong cache (App Shell)
          // QUAN TRỌNG: ignoreSearch: true giúp match được ngay cả khi URL có query string (vd: /?q=mn1)
          let cachedResponse = await cache.match("./index.html", { ignoreSearch: true });
          
          // 2. Fallback: Nếu không thấy index.html, thử tìm root "./"
          if (!cachedResponse) {
              cachedResponse = await cache.match("./", { ignoreSearch: true });
          }
          
          // 3. OFFLINE FIRST: Nếu tìm thấy trong cache, trả về ngay lập tức
          if (cachedResponse) {
              return cachedResponse;
          }
          
          // 4. Chỉ khi KHÔNG có trong cache mới gọi mạng
          return await fetch(request);

        } catch (e) {
          // 5. Nếu mạng lỗi và cache rỗng -> Trả về trang lỗi Offline giả lập (Status 200)
          // Trả về 200 thay vì 408/500 để trình duyệt Android không hiển thị màn hình "No Internet" (Dino)
          return new Response(
            `<!DOCTYPE html>
             <html lang="en">
               <head>
                 <meta charset="UTF-8">
                 <meta name="viewport" content="width=device-width, initial-scale=1.0">
                 <title>Offline</title>
                 <style>
                   body { font-family: sans-serif; text-align: center; padding: 40px 20px; color: #555; }
                   h1 { color: #d35400; margin-bottom: 10px; }
                   p { margin-bottom: 20px; }
                   button { padding: 10px 20px; background: #d35400; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
                 </style>
               </head>
               <body>
                 <h1>You are Offline</h1>
                 <p>The application shell is missing from the cache.</p>
                 <button onclick="window.location.reload()">Retry Connection</button>
               </body>
             </html>`, 
            { 
              status: 200,
              headers: { "Content-Type": "text/html" }
            }
          );
        }
      })()
    );
    return;
  }

  // [STRATEGY 2] Stale-While-Revalidate / Cache First for Assets
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // ignoreSearch: true để match được các file có version param (ví dụ: app.js?v=...)
      const cachedResponse = await cache.match(request, { ignoreSearch: true });
      
      // Ưu tiên trả về Cache ngay lập tức
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(request);
        // Chỉ cache những response hợp lệ (HTTP 200) và type basic
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Fallback đơn giản cho assets khi offline
        return new Response("Offline", { status: 408 });
      }
    })()
  );
});