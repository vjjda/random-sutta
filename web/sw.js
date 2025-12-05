// Path: web/sw.js

// [IMPORTANT] Hãy Bump version này lên mỗi khi bạn muốn update SW
const CACHE_NAME = "sutta-cache-v20251205-163912";

// [NEW] Log ngay lập tức khi trình duyệt đọc file này
console.log(`%c [SW] Loading Version: ${CACHE_NAME}`, 'background: #333; color: #bada55; padding: 2px 5px; border-radius: 2px;');

const SUTTA_DATA_FILES = [
  "./assets/books/abhidhamma/ds_book.js",
  "./assets/books/abhidhamma/dt_book.js",
  "./assets/books/abhidhamma/kv_book.js",
  "./assets/books/abhidhamma/patthana_book.js",
  "./assets/books/abhidhamma/pp_book.js",
  "./assets/books/abhidhamma/vb_book.js",
  "./assets/books/abhidhamma/ya_book.js",
  "./assets/books/sutta/an_book.js",
  "./assets/books/sutta/dn_book.js",
  "./assets/books/sutta/kn/bv_book.js",
  "./assets/books/sutta/kn/cnd_book.js",
  "./assets/books/sutta/kn/cp_book.js",
  "./assets/books/sutta/kn/dhp_book.js",
  "./assets/books/sutta/kn/iti_book.js",
  "./assets/books/sutta/kn/ja_book.js",
  "./assets/books/sutta/kn/kp_book.js",
  "./assets/books/sutta/kn/mil_book.js",
  "./assets/books/sutta/kn/mnd_book.js",
  "./assets/books/sutta/kn/ne_book.js",
  "./assets/books/sutta/kn/pe_book.js",
  "./assets/books/sutta/kn/ps_book.js",
  "./assets/books/sutta/kn/pv_book.js",
  "./assets/books/sutta/kn/snp_book.js",
  "./assets/books/sutta/kn/tha-ap_book.js",
  "./assets/books/sutta/kn/thag_book.js",
  "./assets/books/sutta/kn/thi-ap_book.js",
  "./assets/books/sutta/kn/thig_book.js",
  "./assets/books/sutta/kn/ud_book.js",
  "./assets/books/sutta/kn/vv_book.js",
  "./assets/books/sutta/mn_book.js",
  "./assets/books/sutta/sn_book.js",
  "./assets/books/vinaya/pli-tv-bi-pm_book.js",
  "./assets/books/vinaya/pli-tv-bi-vb_book.js",
  "./assets/books/vinaya/pli-tv-bu-pm_book.js",
  "./assets/books/vinaya/pli-tv-bu-vb_book.js",
  "./assets/books/vinaya/pli-tv-kd_book.js",
  "./assets/books/vinaya/pli-tv-pvr_book.js"
];

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/modules/constants.js",
  "./assets/modules/utils.js",
  "./assets/modules/filters.js",
  "./assets/modules/renderer.js",
  "./assets/modules/loader.js",
  "./assets/modules/router.js",
  "./assets/modules/search_component.js",
  "./assets/modules/toh_component.js",
  "./assets/modules/db_manager.js",
  "./assets/modules/navigator.js",
  "./assets/modules/ui_factory.js",
  "./assets/modules/sutta_controller.js",
  "./assets/books/sutta_loader.js",
  "./assets/icons/favicon-96x96.png",
  "./assets/icons/favicon.svg",
  "./assets/icons/favicon.ico",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/site.webmanifest",
  "./assets/icons/web-app-manifest-192x192.png",
  "./assets/icons/web-app-manifest-512x512.png",
];

const ALL_ASSETS = CORE_ASSETS.concat(SUTTA_DATA_FILES);

self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log(`[SW] Caching ${ALL_ASSETS.length} assets...`);
      
      // Cách này sẽ log ra file nào bị lỗi thay vì chết đứng
      for (const asset of ALL_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.error(`[SW] ❌ FAILED to cache: ${asset}`, err);
        }
      }
      return;
    })
  );
});

self.addEventListener("activate", (event) => {
  // [NEW] Log khi activate thành công
  console.log(`[SW] Activating ${CACHE_NAME}...`);

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