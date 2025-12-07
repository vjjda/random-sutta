// Path: web/assets/modules/data/io_driver.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("IODriver");

// Setup Global Loader hook cho JSONP (Hỗ trợ file:// protocol)
window.__DB_LOADER__ = window.__DB_LOADER__ || {
    cache: {},
    receive: function(key, data) { this.cache[key] = data; }
};

export const IODriver = {
    /**
     * Fetch tài nguyên (JSON) từ Network hoặc Cache Offline
     */
    async fetchResource(path, key) {
        // 1. Ưu tiên Offline Cache (Loaded via <script>)
        if (window.__DB_LOADER__.cache[key]) {
            return window.__DB_LOADER__.cache[key];
        }

        // 2. Network Fetch (Online / Live Server)
        try {
            const resp = await fetch(path);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (e) {
            logger.warn("fetchResource", `Failed ${path}`, e);
            throw e;
        }
    },

    /**
     * Preload tài nguyên (Dùng cho Download All)
     */
    async preloadUrl(path) {
        try {
            await fetch(path); 
        } catch (e) { /* Ignore fetch errors during preload */ }
    }
};