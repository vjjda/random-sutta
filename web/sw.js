// Path: web/sw.js

// This placeholder is updated by the build script with the release version.
const CACHE_NAME = "sutta-cache-dev-placeholder";
console.log(`%c [SW] Loading Version: ${CACHE_NAME}`, 'background: #333; color: #bada55; padding: 2px 5px; border-radius: 2px;');

// This list is populated by the build script (src/sutta_processor/output/asset_generator.py)
// It contains all the JSON-like data files for suttas.
const SUTTA_DATA_FILES = [];

// These are the core files for the application's "shell".
// They are always cached first.
// Note: JS and CSS files are NOT listed here. They are cached by the browser
// when the versioned index.html is loaded. The SW only needs to cache index.html.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/icons/favicon-96x96.png",
  "./assets/icons/favicon.svg",
  "./assets/icons/favicon.ico",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/site.webmanifest",
  "./assets/icons/web-app-manifest-192x192.png",
  "./assets/icons/web-app-manifest-512x512.png",
  "./assets/fonts/NotoSans-VariableFont_wdth,wght.ttf",
  "./assets/fonts/NotoSans-Italic-VariableFont_wdth,wght.ttf"
];

self.addEventListener("install", (event) => {
  console.log(`[SW] Event: install (${CACHE_NAME})`);
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // SUTTA_DATA_FILES is empty during development but populated during build.
      const allAssets = [...SHELL_ASSETS, ...SUTTA_DATA_FILES];
      console.log(`[SW] Caching ${allAssets.length} assets...`);
      
      // We use a loop with individual `add` for better error logging,
      // instead of `addAll` which fails silently on the first error.
      for (const asset of allAssets) {
        try {
          await cache.add(new Request(asset, { cache: 'reload' }));
        } catch (err) {
          console.error(`[SW] ❌ FAILED to cache: ${asset}`, err);
        }
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log(`[SW] Event: activate (${CACHE_NAME})`);
  // Take control of all clients immediately.
  self.clients.claim();
  // Clean up old caches.
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
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Try cache first
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Fallback to network
      try {
        const networkResponse = await fetch(request);
        // If the request is successful and for a same-origin resource,
        // clone it and put it in the cache for future requests.
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // 3. Handle offline for navigation requests by serving the main page.
        if (request.mode === "navigate") {
          console.log("[SW] Fetch failed, serving index.html as fallback for navigation.");
          return await cache.match("./index.html");
        }
        // For other failed requests (e.g., images), just fail.
        return new Response("Network error", {
          status: 408,
          headers: { "Content-Type": "text/plain" },
        });
      }
    })()
  );
});