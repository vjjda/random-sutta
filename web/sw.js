// Path: web/sw.js

// This placeholder is updated by the build script with the release version.
const CACHE_NAME = "sutta-cache-dev-placeholder";
console.log(`%c [SW] Loading Version: ${CACHE_NAME}`, 'background: #333; color: #bada55; padding: 2px 5px; border-radius: 2px;');

// This list is populated by the build script (src/sutta_processor/output/asset_generator.py)
// It contains all the JSON-like data files for suttas.
const SUTTA_DATA_FILES = [];

// These are the core files for the application's "shell".
// Note: JS and CSS files are not listed here. They are cached automatically
// by the browser when the versioned index.html is loaded.
const SHELL_ASSETS = [
  "./", // Serves index.html for root navigation
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

// Combine all assets to be cached during installation.
const ALL_ASSETS_TO_CACHE = [...SHELL_ASSETS, ...SUTTA_DATA_FILES];

self.addEventListener("install", (event) => {
  console.log(`[SW] Event: install (${CACHE_NAME})`);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log(`[SW] Caching ${ALL_ASSETS_TO_CACHE.length} assets...`);
      // Use addAll for atomic caching. If one file fails, the whole cache operation fails.
      // We wrap it in a loop with individual `add` for better error logging.
      for (const asset of ALL_ASSETS_TO_CACHE) {
        try {
          // Use a Request object to ignore query parameters for caching
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
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") {
    return;
  }

  // Caching strategy:
  // 1. Try to find the request in the cache.
  // 2. If not found, go to the network.
  // 3. If network fails and it's a navigation request, serve index.html as a fallback.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Try cache first
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Fallback to network
      try {
        const networkResponse = await fetch(request);
        // If the request is successful, clone it and cache it.
        if (networkResponse && networkResponse.status === 200) {
            // Cache only basic, same-origin requests.
            if (networkResponse.type === 'basic') {
                 cache.put(request, networkResponse.clone());
            }
        }
        return networkResponse;
      } catch (error) {
        // 3. Handle offline for navigation requests
        if (request.mode === "navigate") {
          console.log("[SW] Fetch failed, serving index.html as fallback for navigation.");
          return caches.match("./index.html");
        }
        // For other failed requests, just return an error.
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable"
        });
      }
    })
  );
});