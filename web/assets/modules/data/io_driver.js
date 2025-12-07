// Path: web/assets/modules/data/io_driver.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("IODriver");

window.__DB_LOADER__ = window.__DB_LOADER__ || {
    cache: {},
    receive: function(key, data) { 
        // logger.debug("Loader", `Received ${key}`);
        this.cache[key] = data; 
    }
};

export const IODriver = {
    /**
     * Helper: Tải dữ liệu bằng cách inject thẻ <script> (JSONP pattern).
     * Dùng cho môi trường file:// nơi fetch() bị chặn.
     */
    _loadScript(path, key) {
        return new Promise((resolve, reject) => {
            // Kiểm tra cache lần nữa (phòng trường hợp async race condition)
            if (window.__DB_LOADER__.cache[key]) {
                return resolve(window.__DB_LOADER__.cache[key]);
            }

            const script = document.createElement('script');
            // Trong bản Offline Build, file .json đã được đổi đuôi thành .js
            script.src = path.replace('.json', '.js');
            script.async = true;

            script.onload = () => {
                // Sau khi script chạy, nó sẽ gọi __DB_LOADER__.receive và đẩy data vào cache
                const data = window.__DB_LOADER__.cache[key];
                if (data) {
                    resolve(data);
                } else {
                    reject(new Error(`Script loaded but key '${key}' not found in cache`));
                }
                script.remove(); // Dọn dẹp DOM
            };

            script.onerror = (e) => {
                script.remove();
                reject(new Error(`Script load error: ${path}`));
            };

            document.head.appendChild(script);
        });
    },

    async fetchResource(path, key) {
        // 1. Check Memory Cache
        if (window.__DB_LOADER__.cache[key]) {
            return window.__DB_LOADER__.cache[key];
        }

        // 2. Try Fetch (Ưu tiên cho Online/Localhost)
        try {
            // Nếu đang ở file://, fetch thường sẽ throw error ngay lập tức
            if (window.location.protocol === 'file:') {
                throw new Error("File protocol detected, skipping fetch");
            }

            const resp = await fetch(path);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();

        } catch (e) {
            // 3. Fallback to Script Injection (Cho Offline Mode / File Protocol)
            // logger.warn("fetchResource", `Fetch failed (${e.message}), trying Script fallback...`);
            try {
                return await this._loadScript(path, key);
            } catch (scriptErr) {
                logger.error("fetchResource", `All methods failed for ${path}`, scriptErr);
                throw scriptErr;
            }
        }
    },

    async preloadUrl(path) {
        // Với preload download all, ta cũng phải check protocol
        if (window.location.protocol === 'file:') {
            // Ở chế độ file://, không thể "download" để cache vào SW được (vì SW không chạy).
            // Nên ta bỏ qua việc preload.
            return;
        }
        try { await fetch(path); } catch (e) {}
    }
};