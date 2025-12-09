// Path: web/assets/modules/data/sutta_repository.js
import { DbAdapter } from './db_adapter.js';
import { IndexResolver } from './index_resolver.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("Repository");

export const SuttaRepository = {
    // ... (Giữ nguyên init, resolveLocation, fetchMeta, fetchContentChunk) ...
    async init() {
        await DbAdapter.init();
    },

    async resolveLocation(uid) {
        return await IndexResolver.resolve(uid);
    },

    async fetchMeta(bookId) {
        const cached = await DbAdapter.get("meta", bookId);
        if (cached) return cached;

        return this._loadData('meta', bookId);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const key = `${bookId}_chunk_${chunkIdx}`;
        const cached = await DbAdapter.get("content", key);
        if (cached) return cached;

        return this._loadData('content', key);
    },

    // ... (Giữ nguyên _loadData và _loadJsZip) ...
    async _loadData(category, filenameKey) {
        const isFileProtocol = window.location.protocol === 'file:';
        const path = `assets/db/${category}/${filenameKey}`;

        if (isFileProtocol) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${path}.js`;
                script.onload = async () => {
                    const data = await DbAdapter.get(category, filenameKey);
                    resolve(data || null);
                    script.remove();
                };
                script.onerror = () => {
                    logger.warn("_loadData", `Offline resource not found: ${path}`);
                    resolve(null); 
                    script.remove();
                };
                document.head.appendChild(script);
            });
        } else {
            try {
                const res = await fetch(`${path}.json`);
                if (!res.ok) {
                    logger.warn("_loadData", `Fetch 404: ${path}`);
                    return null;
                }
                const data = await res.json();
                DbAdapter.set(category, filenameKey, data).catch(() => {});
                return data;
            } catch (e) {
                logger.error("_loadData", `Fetch failed: ${path}`, e);
                return null;
            }
        }
    },

    async _loadJsZip() {
        if (window.JSZip) return window.JSZip;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'assets/libs/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error("Failed to load JSZip"));
            document.head.appendChild(script);
        });
    },

    /**
     * [REFACTORED] Resolve ID -> Book ID trước khi fetch
     * Sửa lỗi fetch nhầm node ID làm filename (ví dụ an4.304-783.json)
     */
    async fetchMetaList(ids) {
        const results = {};
        const booksToFetch = new Set();

        // 1. Resolve Location cho từng ID để tìm Book ID thực sự
        await Promise.all(ids.map(async (uid) => {
            // IndexResolver đủ thông minh để biết uid thuộc về sách nào
            const loc = await this.resolveLocation(uid); // [bookId, chunkIdx]
            if (loc && loc[0]) {
                booksToFetch.add(loc[0]);
            } else {
                // Nếu không resolve được (ví dụ ID rác), ta bỏ qua, không fetch bừa
                // logger.debug("fetchMetaList", `Cannot resolve book for ${uid}`);
            }
        }));

        // 2. Fetch Metadata của các sách đã tìm được
        await Promise.all(Array.from(booksToFetch).map(async (bid) => {
            const data = await this.fetchMeta(bid);
            if (data && data.meta) {
                Object.assign(results, data.meta);
            }
        }));
        
        return results;
    },

    // ... (Giữ nguyên downloadAll) ...
    async downloadAll(progressCallback) {
        if (window.location.protocol === 'file:') {
            logger.info("Sync", "Skipping download in File Protocol mode.");
            if (progressCallback) progressCallback(100, 100);
            return;
        }

        logger.info("Sync", "Starting full download via Zip Bundle...");
        const JSZip = await this._loadJsZip();
        
        // [FIX] Add timestamp to bypass old cached zip
        const res = await fetch(`assets/db/db_bundle.zip?v=${Date.now()}`);
        if (!res.ok) throw new Error("Bundle not found");
        
        const blob = await res.blob();
        const zip = await JSZip.loadAsync(blob);
        const files = Object.keys(zip.files);
        let count = 0;
        const total = files.length;

        // [FIX] Prepare Cache access for index files
        let cache = null;
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                const suttaCaches = keys.filter(k => k.startsWith("sutta-cache-"));
                suttaCaches.sort().reverse(); // Newest first
                const cacheName = suttaCaches[0] || "sutta-cache-temp";
                cache = await caches.open(cacheName);
                logger.info("Sync", `Writing index files to cache: ${cacheName}`);
            }
        } catch (e) {
            logger.warn("Sync", "Could not open Cache Storage", e);
        }

        for (const filename of files) {
            if (zip.files[filename].dir) continue;
            
            // Read content
            const contentStr = await zip.files[filename].async("string");
            
            if (filename.startsWith("meta/")) {
                const data = JSON.parse(contentStr);
                const bookId = filename.split("/")[1].replace(".json", "");
                await DbAdapter.set("meta", bookId, data);
            } 
            else if (filename.startsWith("content/")) {
                const data = JSON.parse(contentStr);
                const key = filename.split("/")[1].replace(".json", "");
                await DbAdapter.set("content", key, data);
            }
            else if (filename.startsWith("index/") && cache) {
                // [FIX] Save index files to Cache Storage so fetch() works
                const targetUrl = new URL(`assets/db/${filename}`, window.location.href).href;
                const headers = new Headers({
                    'Content-Type': 'application/json',
                    'Content-Length': contentStr.length.toString()
                });
                const response = new Response(contentStr, {
                    status: 200,
                    statusText: "OK",
                    headers: headers
                });
                await cache.put(targetUrl, response);
            }

            count++;
            if (progressCallback && count % 20 === 0) progressCallback(count, total);
        }
        if (progressCallback) progressCallback(total, total);
        logger.info("Sync", "Full download completed.");
    }
};