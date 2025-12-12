// Path: web/assets/modules/data/core_network.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("CoreNetwork");

/**
 * Core Network Utilities
 * Xử lý Fetch, Caching và Error Handling ở mức thấp.
 */
export const CoreNetwork = {
    
    /**
     * Tải JSON từ URL.
     * @param {string} url 
     * @returns {Promise<any|null>} Parsed JSON hoặc null nếu lỗi
     */
    async fetchJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug("fetchJson", `Not found: ${url}`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            logger.error("fetchJson", `Failed to load ${url}`, e);
            return null;
        }
    },

    /**
     * Kiểm tra xem URL đã có trong Cache chưa (dành cho logic Offline).
     * @param {string} url 
     * @returns {Promise<boolean>}
     */
    async isCached(url) {
        if (!('caches' in self)) return false;
        try {
            // Tìm trong tất cả các cache key
            const keys = await caches.keys();
            for (const key of keys) {
                const cache = await caches.open(key);
                const match = await cache.match(url);
                if (match) return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    },

    /**
     * Tải hàng loạt URL và đưa vào Cache (dùng cho tính năng Download Offline).
     * @param {string[]} urls - Danh sách URL cần cache
     * @param {string} cacheName - Tên cache bucket
     * @param {Function} onProgress - Callback (current, total) => void
     */
    async cacheBatch(urls, cacheName, onProgress) {
        if (!('caches' in self)) {
            logger.warn("cacheBatch", "Cache API not supported");
            return;
        }

        const cache = await caches.open(cacheName);
        let completed = 0;
        const total = urls.length;

        // Chia nhỏ batch để tránh nghẽn mạng (Chunk size = 10)
        const chunkSize = 10;
        for (let i = 0; i < total; i += chunkSize) {
            const chunk = urls.slice(i, i + chunkSize);
            
            await Promise.all(chunk.map(async (url) => {
                try {
                    // Chỉ fetch nếu chưa có trong cache này
                    const match = await cache.match(url);
                    if (!match) {
                        await cache.add(url);
                    }
                } catch (e) {
                    logger.warn("cacheBatch", `Failed to cache ${url}`, e);
                } finally {
                    completed++;
                    if (onProgress) onProgress(completed, total);
                }
            }));
        }
    }
};