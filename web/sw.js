// Path: web/sw.js

// Tên cache sẽ được cập nhật tự động bởi release.py
const CACHE_NAME = 'sutta-reader-cache-v1.0.6'; //  -> (Giả sử release.py đã chạy)

// Danh sách các file dữ liệu sutta được tạo ra bởi sutta_processor/manager.py
// Đây là danh sách đầy đủ các files trong web/assets/sutta/books/
const SUTTA_DATA_FILES = [
  "an.js", "dn.js",
  "kn/bv.js", "kn/cnd.js", "kn/cp.js", "kn/dhp.js", "kn/iti.js", 
  "kn/ja.js", "kn/kp.js", "kn/mil.js", "kn/mnd.js", "kn/ne.js", 
  "kn/pe.js", "kn/ps.js", "kn/pv.js", "kn/snp.js", "kn/tha-ap.js", 
  "kn/thag.js", "kn/thi-ap.js", "kn/thig.js", "kn/ud.js", "kn/vv.js", 
  "mn.js", "sn.js"
].map(file => `./assets/sutta/books/${file}`);

// Danh sách các file metadata tên sutta được tạo ra bởi name_parser.py
// Đây là danh sách đầy đủ các files trong web/assets/sutta/names/
const NAME_DATA_FILES = [
  "an-name.js", "dn-name.js", 
  "kn/bv-name.js", "kn/cnd-name.js", "kn/cp-name.js", "kn/dhp-name.js", 
  "kn/iti-name.js", "kn/ja-name.js", "kn/kp-name.js", "kn/mil-name.js", 
  "kn/mnd-name.js", "kn/ne-name.js", "kn/pe-name.js", "kn/ps-name.js", 
  "kn/pv-name.js", "kn/snp-name.js", "kn/tha-ap-name.js", "kn/thag-name.js", 
  "kn/thi-ap-name.js", "kn/thig-name.js", "kn/ud-name.js", "kn/vv-name.js", 
  "mn-name.js", "sn-name.js"
].map(file => `./assets/sutta/names/${file}`);

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
    './assets/sutta/name_loader.js',
    // Thêm các file icon
    './assets/icons/favicon-96x96.png',
    './assets/icons/favicon.svg',
    './assets/icons/favicon.ico',
    './assets/icons/apple-touch-icon.png',
    './assets/icons/site.webmanifest',
    './assets/icons/web-app-manifest-192x192.png',
    './assets/icons/web-app-manifest-512x512.png',
];

// Danh sách tất cả các files cần precache
const ALL_ASSETS = CORE_ASSETS.concat(SUTTA_DATA_FILES, NAME_DATA_FILES);

// 1. Install: Cache core assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Kích hoạt ngay lập tức
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching ALL assets for offline use...');
            // Thay đổi từ CORE_ASSETS sang ALL_ASSETS
            return cache.addAll(ALL_ASSETS);
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
            
            // 1. NẾU CÓ TRONG CACHE, TRẢ VỀ NGAY (Cache First)
            if (cachedResponse) {
                return cachedResponse; 
            }

            // 2. NẾU KHÔNG CÓ TRONG CACHE, THỬ TẢI MẠNG
            return fetch(event.request).then((networkResponse) => {
                // Chỉ cache các request hợp lệ
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse; 
                }

                // Sao chép response để cache
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse; 
            }).catch(() => {
                // 3. NẾU MẤT MẠNG VÀ CHƯA CACHE -> Bỏ qua và để client tự xử lý lỗi
                console.log('[SW] Offline and resource not cached:', event.request.url); 
                // Trả về một Response rỗng để tránh lỗi Promise bị reject không cần thiết
                return new Response(null, { status: 404, statusText: 'Not Found' });
            });
        })
    );
});