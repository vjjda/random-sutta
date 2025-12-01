// Path: web/sw.js

// Tên cache sẽ được cập nhật tự động bởi release.py
const CACHE_NAME = 'sutta-reader-cache-v1';

// Các file cốt lõi cần cache ngay lập tức
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/style.css',
    './assets/app.js',
    './assets/modules/constants.js',
    './assets/modules/utils.js',
    './assets/modules/filters.js',
    './assets/modules/renderer.js',
    './assets/sutta/sutta_loader.js',
    './assets/sutta/name_loader.js'
];

// 1. Install: Cache core assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Kích hoạt ngay lập tức
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching core assets...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// 2. Activate: Xóa cache cũ
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Fetch: Chiến lược Cache First (Ưu tiên Cache, nếu không có mới tải mạng)
self.addEventListener('fetch', (event) => {
    // Chỉ xử lý GET request
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            // Nếu chưa có trong cache thì tải từ mạng và lưu vào cache
            return fetch(event.request).then((networkResponse) => {
                // Chỉ cache các request hợp lệ
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Fallback nếu mất mạng hoàn toàn và chưa cache
                console.log('[SW] Offline and resource not cached:', event.request.url);
            });
        })
    );
});