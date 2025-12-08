// Path: web/assets/modules/data/loader/asset_loader.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("AssetLoader");

// Hàng đợi Promise để tránh tải trùng và đợi Script Tag load xong
const PENDING_REQUESTS = new Map();

// Setup Global Loader 1 lần duy nhất để hứng JSONP từ file .js
if (!window.__DB_LOADER__) {
    window.__DB_LOADER__ = {
        receive: (key, data) => {
            if (PENDING_REQUESTS.has(key)) {
                const { resolve } = PENDING_REQUESTS.get(key);
                resolve(data);
                PENDING_REQUESTS.delete(key);
            }
        }
    };
}

export const AssetLoader = {
    /**
     * Kiểm tra xem App đang chạy ở chế độ Offline cứng (file://) 
     * hoặc đã được build offline (có biến global index) chưa.
     */
    isOfflineMode() {
        return window.__DB_INDEX__ !== undefined || window.location.protocol === 'file:';
    },

    /**
     * Hàm Generic để tải file dữ liệu.
     * @param {string} key - Định danh duy nhất (vd: 'an1', 'mn_chunk_0') - Phải khớp với key trong file JS offline
     * @param {string} relativePath - Đường dẫn tương đối từ assets/db/ (vd: 'meta/an1', 'content/mn_chunk_0')
     */
    load: async function(key, relativePath) {
        if (this.isOfflineMode()) {
            return this._loadScript(key, relativePath);
        } else {
            return this._loadFetch(relativePath);
        }
    },

    _loadFetch: async function(relativePath) {
        const url = `assets/db/${relativePath}.json`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            return await resp.json();
        } catch (e) {
            logger.warn("_loadFetch", `Failed: ${url}`, e);
            return null;
        }
    },

    _loadScript: function(key, relativePath) {
        if (PENDING_REQUESTS.has(key)) {
            return PENDING_REQUESTS.get(key).promise;
        }

        return new Promise((resolve, reject) => {
            PENDING_REQUESTS.set(key, { resolve, reject });

            const script = document.createElement('script');
            // Trong chế độ Offline, file .json đã được convert thành .js
            script.src = `assets/db/${relativePath}.js`;
            script.async = true;

            script.onerror = () => {
                PENDING_REQUESTS.delete(key);
                logger.warn("_loadScript", `Failed: ${script.src}`);
                // Không reject cứng để app không crash, trả về null
                resolve(null); 
                script.remove();
            };

            script.onload = () => {
                // Dữ liệu sẽ được resolve thông qua window.__DB_LOADER__.receive
                // Script tag xong việc thì bỏ đi cho gọn DOM
                script.remove();
            };

            document.body.appendChild(script);
        });
    }
};