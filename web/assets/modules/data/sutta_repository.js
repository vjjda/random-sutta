// Path: web/assets/modules/data/sutta_repository.js
import { DbAdapter } from './db_adapter.js';
import { IndexResolver } from './index_resolver.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("Repository");

export const SuttaRepository = {
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

    /**
     * Transport Layer thông minh
     * [FIXED] Xử lý lỗi script loading (Offline) để trả về null thay vì throw Error
     */
    async _loadData(category, filenameKey) {
        const isFileProtocol = window.location.protocol === 'file:';
        const path = `assets/db/${category}/${filenameKey}`;

        if (isFileProtocol) {
            // --- Strategy A: JSON-P Injection (Offline Build) ---
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${path}.js`;
                
                script.onload = async () => {
                    const data = await DbAdapter.get(category, filenameKey);
                    // Nếu load script thành công mà không có data trong Adapter -> trả null
                    resolve(data || null);
                    script.remove();
                };
                
                script.onerror = () => {
                    // [CHANGE] Thay vì reject(new Error...), ta log warning và trả về null
                    // Điều này giúp app không bị crash khi thiếu file phụ (như kn.js)
                    logger.warn("_loadData", `Offline resource not found: ${path}`);
                    resolve(null); 
                    script.remove();
                };
                
                document.head.appendChild(script);
            });

        } else {
            // --- Strategy B: Fetch (Online / Server) ---
            try {
                const res = await fetch(`${path}.json`);
                if (!res.ok) {
                    // 404 hoặc lỗi mạng -> trả null
                    logger.warn("_loadData", `Fetch 404: ${path}`);
                    return null;
                }
                const data = await res.json();
                
                // Lưu cache background
                DbAdapter.set(category, filenameKey, data).catch(() => {});
                return data;
            } catch (e) {
                logger.error("_loadData", `Fetch failed: ${path}`, e);
                return null;
            }
        }
    },

    async fetchMetaList(bookIds) {
        const results = {};
        const uniqueIds = [...new Set(bookIds)];
        await Promise.all(uniqueIds.map(async (bid) => {
            const data = await this.fetchMeta(bid);
            if (data && data.meta) Object.assign(results, data.meta);
        }));
        return results;
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

    async downloadAll(progressCallback) {
        // [FIX] Không chạy download nếu đang ở chế độ file:// (Offline Build đã có sẵn file)
        if (window.location.protocol === 'file:') {
            logger.info("Sync", "Skipping download in File Protocol mode.");
            if (progressCallback) progressCallback(100, 100);
            return;
        }

        logger.info("Sync", "Starting full download via Zip Bundle...");
        const JSZip = await this._loadJsZip();
        
        const res = await fetch('assets/db/db_bundle.zip');
        if (!res.ok) throw new Error("Bundle not found");
        
        const blob = await res.blob();
        const zip = await JSZip.loadAsync(blob);
        const files = Object.keys(zip.files);
        let count = 0;
        const total = files.length;

        for (const filename of files) {
            if (zip.files[filename].dir) continue;
            const contentStr = await zip.files[filename].async("string");
            const data = JSON.parse(contentStr);
            
            if (filename.startsWith("meta/")) {
                const bookId = filename.split("/")[1].replace(".json", "");
                await DbAdapter.set("meta", bookId, data);
            } 
            else if (filename.startsWith("content/")) {
                const key = filename.split("/")[1].replace(".json", "");
                await DbAdapter.set("content", key, data);
            }
            count++;
            if (progressCallback && count % 20 === 0) progressCallback(count, total);
        }
        if (progressCallback) progressCallback(total, total);
        logger.info("Sync", "Full download completed.");
    }
};