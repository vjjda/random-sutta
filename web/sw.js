// Path: web/sw.js

// [IMPORTANT] Giữ nguyên placeholder này để Release System tự động replace bằng version tag thật
const CACHE_NAME = "sutta-cache-dev-placeholder";
// [NEW] Cache riêng cho Data (DB Zips) để không bị xóa khi App Version đổi
const DATA_CACHE_NAME = "sutta-data-cache";

console.log(`[SW] Startup (${CACHE_NAME})`);

// Danh sách file bắt buộc phải có để App chạy offline
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
  
  // Fonts [UPDATED] - Changed from .ttf to .woff2 to match CSS
  "./assets/fonts/NotoSans-Regular.woff2",
  "./assets/fonts/NotoSans-Italic.woff2",

  // Data
  "./assets/modules/data/constants.js",

  // [AUTO_GENERATED_ASSETS]
];

// 1. INSTALL: Tải và cache toàn bộ Shell Assets
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  // Kích hoạt ngay lập tức, không chờ tab đóng
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching shell assets...");
      return cache.addAll(SHELL_ASSETS);
    })
  );
});

// 2. ACTIVATE: Dọn dẹp cache cũ và claim clients
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    Promise.all([
      // Claim clients để SW kiểm soát page ngay lập tức mà không cần reload
      self.clients.claim(),
      // Xóa cache cũ
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            // [FIX] Chỉ xóa App Cache cũ, KHÔNG xóa Data Cache
            if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cache);
              return caches.delete(cache);
            }
          })
        );
      })
    ])
  );
});

// 3. FETCH: Xử lý request
self.addEventListener("fetch", (event) => {
  const request = event.request;
  
  // Chỉ xử lý GET request
  if (request.method !== "GET") return;

  // [CHIẾN LƯỢC 1] App Shell cho Navigation (Fix lỗi Refresh Offline)
  // Áp dụng khi trình duyệt điều hướng (F5, nhập URL, click link)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          
          // A. Thử tìm chính request đó trong cache (bỏ qua query param ?q=...)
          // Ví dụ: http://.../?q=mn1 -> tìm http://.../
          let cachedResponse = await cache.match(request, { ignoreSearch: true });
          
          // B. Nếu không thấy, thử tìm đích danh "index.html"
          if (!cachedResponse) {
             cachedResponse = await cache.match("index.html");
          }
          
          // C. Nếu vẫn không thấy, thử tìm "./" (Root)
          if (!cachedResponse) {
             cachedResponse = await cache.match("./");
          }

          // D. Nếu tìm thấy bất kỳ cái nào, trả về ngay (OFFLINE FIRST)
          if (cachedResponse) {
              return cachedResponse;
          }
          
          // E. Nếu không có trong cache, buộc phải gọi mạng
          console.log("[SW] Nav not in cache, fetching:", request.url);
          return await fetch(request);

        } catch (e) {
          console.error("[SW] Fetch failed:", e);
          // F. Mạng lỗi và Cache rỗng -> Trả về trang lỗi giả lập
          // Status 200 giúp tránh màn hình "Dino" của trình duyệt
          const errorHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px 20px; color: #333; }
                    h1 { color: #d35400; margin-bottom: 10px; }
                    p { margin-bottom: 20px; line-height: 1.5; }
                    button { padding: 12px 24px; background: #d35400; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer; }
                    button:active { opacity: 0.8; }
                </style>
            </head>
            <body>
                <h1>You are Offline</h1>
                <p>The application shell data is missing from your device.<br>Please check your internet connection.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
            </body>
            </html>`;
          return new Response(errorHtml, { 
              status: 200, 
              headers: { "Content-Type": "text/html" } 
          });
        }
      })()
    );
    return;
  }

  // [CHIẾN LƯỢC 2] Hybrid Strategy for Assets
  event.respondWith(
    (async () => {
      // [FIX] Chọn cache bucket phù hợp
      let targetCacheName = CACHE_NAME;
      if (request.url.endsWith('.zip')) {
          targetCacheName = DATA_CACHE_NAME;
      }
      
      const cache = await caches.open(targetCacheName);
      
      // A. Network First for Manifests/DB Configs (JSON in assets/db)
      // Ensures we always get the latest hash check
      if (request.url.includes('assets/db/') && request.url.includes('.json')) {
          try {
              const networkResponse = await fetch(request);
              if (networkResponse && networkResponse.status === 200) {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
              }
          } catch (e) {
              console.log("[SW] Network First failed for manifest, falling back to cache.");
          }
          // Fallback to cache
          return await cache.match(request) || new Response("Offline", { status: 408 });
      }

      // B. Cache First for everything else (JS, CSS, Images, WOFF2, ZIPs)
      // 1. Tìm trong cache trước (bỏ qua search param để match version tag ?v=...)
      const cachedResponse = await cache.match(request, { ignoreSearch: true });
      if (cachedResponse) return cachedResponse;

      // 2. Nếu không có, gọi mạng và cache lại
      try {
        const networkResponse = await fetch(request);
        
        // Chỉ cache những response thành công và đúng loại
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Fallback đơn giản cho asset
        console.log("[SW] Asset fetch failed:", request.url);
        return new Response("Offline", { status: 408 });
      }
    })()
  );
});