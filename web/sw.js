// Path: web/sw.js

// Tên cache mới (Nên bump version khi deploy)
const CACHE_NAME = "sutta-reader-cache-v1.2.5";

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

// REMOVED: const NAME_DATA_FILES = ...

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
  "./assets/books/sutta_loader.js",
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
