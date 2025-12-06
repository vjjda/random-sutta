// Path: web/sw.js

// [VERSIONING] Biến này sẽ được Release System tự động replace khi build
const CACHE_NAME = "sutta-cache-dev-placeholder";

console.log(`[SW] Startup (${CACHE_NAME})`);

// 1. CORE ASSETS (Pre-cache)
// Chỉ tải những file này ngay lập tức.
// Tuyệt đối KHÔNG liệt kê các file Chunk nội dung ở đây.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css", // Đã bundle
  "./assets/app.bundle.js", // Đã bundle (hoặc file module nếu chạy dev)
  
  // Icons
  "./assets/icons/favicon.ico",
  "./assets/icons/favicon.svg",
  "./assets/icons/site.webmanifest",
  "./assets/icons/web-app-manifest-192x192.png",
  "./assets/icons/web-app-manifest-512x512.png",
  
  // Fonts
  "./assets/fonts/NotoSans-VariableFont_wdth,wght.ttf",
  "./assets/fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf",

  // [IMPORTANT] Database Index & Config
  // Đây là 2 file dữ liệu duy nhất cần tải trước để App chạy được
  "./assets/db/uid_index.json",
  "./assets/modules/data/constants.js"
];

// Sự kiện Install: Tải Shell Assets
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  self.skipWaiting(); // Kích hoạt ngay lập tức

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`[SW] Pre-caching ${SHELL_ASSETS.length} shell items.`);
      return cache.addAll(SHELL_ASSETS).catch(err => {
          console.error("[SW] Pre-cache failed:", err);
      });
    })
  );
});

// Sự kiện Activate: Dọn dẹp Cache cũ
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  self.clients.claim(); // Chiếm quyền kiểm soát các tabs ngay lập tức

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

// Sự kiện Fetch: Chiến lược Cache-First (Stale-While-Revalidate cho DB)
self.addEventListener("fetch", (event) => {
  const request = event.request;
  
  // Chỉ xử lý GET request
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        // Return ngay nếu có trong cache
        return cachedResponse;
      }

      // Nếu không có, tải từ mạng
      try {
        const networkResponse = await fetch(request);
        
        // Logic Runtime Caching:
        // Nếu tải thành công file hợp lệ (status 200), lưu vào cache dùng cho lần sau.
        // Đây chính là cơ chế "Lazy Load": Người dùng đọc kinh nào, lưu kinh đó.
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            // Clone response để lưu (stream chỉ đọc được 1 lần)
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;

      } catch (error) {
        // Xử lý Offline
        console.warn("[SW] Fetch failed (Offline):", request.url);
        
        // Nếu là request điều hướng (vào trang web), trả về index.html (SPA Fallback)
        if (request.mode === "navigate") {
          return cache.match("./index.html");
        }
        
        // Các trường hợp khác (ảnh, json) thì chịu chết
        return new Response("Offline - Content not cached", { status: 408 });
      }
    })()
  );
});