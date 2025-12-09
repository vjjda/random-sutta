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

        try {
            const res = await fetch(`assets/db/meta/${bookId}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            DbAdapter.set("meta", bookId, data).catch(e => logger.warn("Cache", "Save meta failed", e));
            return data;
        } catch (e) {
            logger.error("fetchMeta", `Failed to load ${bookId}`, e);
            return null;
        }
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const key = `${bookId}_chunk_${chunkIdx}`;
        const cached = await DbAdapter.get("content", key);
        if (cached) return cached;

        try {
            const fname = `${bookId}_chunk_${chunkIdx}.json`;
            const res = await fetch(`assets/db/content/${fname}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            DbAdapter.set("content", key, data).catch(e => logger.warn("Cache", "Save content failed", e));
            return data;
        } catch (e) {
            logger.error("fetchContent", `Failed to load ${key}`, e);
            return null;
        }
    },

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
     * [NEW] Helper tải thư viện động
     */
    async _loadJsZip() {
        if (window.JSZip) return window.JSZip; // Đã tải rồi thì dùng luôn

        logger.info("Loader", "Loading JSZip library on-demand...");
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'assets/libs/jszip.min.js';
            script.onload = () => {
                logger.info("Loader", "JSZip loaded.");
                resolve(window.JSZip);
            };
            script.onerror = () => reject(new Error("Failed to load JSZip script"));
            document.head.appendChild(script);
        });
    },

    async downloadAll(progressCallback) {
        logger.info("Sync", "Starting full download via Zip Bundle...");
        
        // 1. Tải thư viện động (Chỉ khi cần download mới tải lib này)
        const JSZip = await this._loadJsZip();
        if (!JSZip) throw new Error("JSZip library not loaded");

        // 2. Fetch Bundle
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
            if (progressCallback && count % 20 === 0) { // Giảm tần suất update UI để tăng tốc
                progressCallback(count, total);
            }
        }
        
        if (progressCallback) progressCallback(total, total);
        logger.info("Sync", "Full download completed.");
    }
};