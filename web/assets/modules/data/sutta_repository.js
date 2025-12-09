// Path: web/assets/modules/data/sutta_repository.js
import { DbAdapter } from './db_adapter.js';
import { IndexResolver } from './index_resolver.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("Repository");

export const SuttaRepository = {
    async init() {
        await DbAdapter.init();
    },

    // Delegate cho Resolver
    async resolveLocation(uid) {
        return await IndexResolver.resolve(uid);
    },

    /**
     * Lấy Metadata sách (ưu tiên Cache DB -> Network)
     */
    async fetchMeta(bookId) {
        // 1. Try DB
        const cached = await DbAdapter.get("meta", bookId);
        if (cached) return cached;

        // 2. Fetch Network
        try {
            const res = await fetch(`assets/db/meta/${bookId}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            // 3. Save DB (Background)
            DbAdapter.set("meta", bookId, data).catch(e => logger.warn("Cache", "Save meta failed", e));
            
            return data;
        } catch (e) {
            logger.error("fetchMeta", `Failed to load ${bookId}`, e);
            return null;
        }
    },

    /**
     * Lấy Content Chunk (ưu tiên Cache DB -> Network)
     */
    async fetchContentChunk(bookId, chunkIdx) {
        // Key quy ước: {bookId}_chunk_{idx}
        const key = `${bookId}_chunk_${chunkIdx}`;
        
        // 1. Try DB
        const cached = await DbAdapter.get("content", key);
        if (cached) return cached;

        // 2. Fetch Network
        try {
            // Filename quy ước: {bookId}_chunk_{idx}.json
            const fname = `${bookId}_chunk_${chunkIdx}.json`;
            const res = await fetch(`assets/db/content/${fname}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // 3. Save DB (Background)
            DbAdapter.set("content", key, data).catch(e => logger.warn("Cache", "Save content failed", e));

            return data;
        } catch (e) {
            logger.error("fetchContent", `Failed to load ${key}`, e);
            return null;
        }
    },

    /**
     * Prefetch nhiều meta cùng lúc (Dùng cho Navigation)
     */
    async fetchMetaList(bookIds) {
        const results = {};
        const uniqueIds = [...new Set(bookIds)];
        
        await Promise.all(uniqueIds.map(async (bid) => {
            const data = await this.fetchMeta(bid);
            if (data && data.meta) {
                Object.assign(results, data.meta);
            }
        }));
        
        return results;
    },

    /**
     * Download toàn bộ dữ liệu Offline (Sử dụng Zip Bundle)
     * [OPTIMIZED] 1 Request thay vì hàng nghìn request
     */
    async downloadAll(progressCallback) {
        logger.info("Sync", "Starting full download via Zip Bundle...");
        
        const JSZip = window.JSZip;
        if (!JSZip) throw new Error("JSZip library not loaded");

        // 1. Tải file zip cục gạch (~30MB)
        const res = await fetch('assets/db/db_bundle.zip');
        if (!res.ok) throw new Error("Bundle not found");
        
        const blob = await res.blob();
        
        // 2. Giải nén
        const zip = await JSZip.loadAsync(blob);
        const files = Object.keys(zip.files);
        let count = 0;
        const total = files.length;

        // 3. Import vào DB
        for (const filename of files) {
            if (zip.files[filename].dir) continue;

            const contentStr = await zip.files[filename].async("string");
            const data = JSON.parse(contentStr);
            
            // Routing dựa trên folder trong zip (meta/..., content/...)
            if (filename.startsWith("meta/")) {
                const bookId = filename.split("/")[1].replace(".json", "");
                await DbAdapter.set("meta", bookId, data);
            } 
            else if (filename.startsWith("content/")) {
                // filename: content/mn_chunk_0.json -> key: mn_chunk_0
                const key = filename.split("/")[1].replace(".json", "");
                await DbAdapter.set("content", key, data);
            }

            count++;
            if (progressCallback && count % 10 === 0) { // Update UI mỗi 10 file
                progressCallback(count, total);
            }
        }
        
        if (progressCallback) progressCallback(total, total);
        logger.info("Sync", "Full download completed.");
    }
};