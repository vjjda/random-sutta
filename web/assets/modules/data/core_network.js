// Path: web/assets/modules/data/core_network.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("CoreNetwork");

export const CoreNetwork = {
    
    async fetchJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            // [IGNORE] Không log lỗi fetch file:// vì đây là hành vi dự kiến
            if (!url.startsWith('http')) return null;
            logger.warn("fetchJson", `Fetch failed: ${url}`);
            return null;
        }
    },

    // [NEW] JSONP Loader cho môi trường file://
    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            
            script.onload = () => {
                script.remove(); // Dọn dẹp DOM
                resolve(true);
            };
            
            script.onerror = (e) => {
                script.remove();
                logger.error("loadScript", `Failed to load script: ${url}`);
                reject(new Error(`Script load error: ${url}`));
            };
            
            document.head.appendChild(script);
        });
    },

    async isCached(url) {
        // ... (Giữ nguyên logic cache check)
        if (!('caches' in self)) return false;
        try {
            const keys = await caches.keys();
            for (const key of keys) {
                const cache = await caches.open(key);
                const match = await cache.match(url);
                if (match) return true;
            }
            return false;
        } catch (e) { return false; }
    },

    async cacheBatch(urls, cacheName, onProgress) {
        // ... (Giữ nguyên logic cache batch)
        if (!('caches' in self)) return;
        const cache = await caches.open(cacheName);
        let completed = 0;
        const total = urls.length;
        const chunkSize = 10;
        for (let i = 0; i < total; i += chunkSize) {
            const chunk = urls.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (url) => {
                try {
                    const match = await cache.match(url);
                    if (!match) await cache.add(url);
                } catch (e) {} finally {
                    completed++;
                    if (onProgress) onProgress(completed, total);
                }
            }));
        }
    }
};