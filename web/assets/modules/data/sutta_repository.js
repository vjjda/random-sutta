// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

const CACHE = {
    meta: new Map(),    
    content: new Map(), 
    index: null         
};

export const SuttaRepository = {
    // ... (Giữ nguyên init và getLocation) ...
    async init() {
        if (CACHE.index) return;
        
        if (window.__DB_INDEX__) {
            CACHE.index = window.__DB_INDEX__;
            logger.info("Init", "Loaded Index from Global (Offline Mode)");
            return;
        }

        try {
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            CACHE.index = await resp.json();
            logger.info("Init", "Loaded Index from Network");
        } catch (e) {
            logger.error("Init", "Failed to load uid_index.json", e);
            throw e;
        }
    },

    getLocation(uid) {
        if (!CACHE.index) return null;
        return CACHE.index[uid] || null;
    },

    async fetchMeta(bookId) {
        if (CACHE.meta.has(bookId)) return CACHE.meta.get(bookId);

        if (window.__DB_LOADER__ && window.__DB_LOADER__.getMeta) {
            const data = window.__DB_LOADER__.getMeta(bookId);
            if (data) {
                CACHE.meta.set(bookId, data);
                return data;
            }
        }

        const url = `assets/db/meta/${bookId}.json`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) return null; 
            const data = await resp.json();
            CACHE.meta.set(bookId, data);
            return data;
        } catch (e) {
            logger.warn("fetchMeta", `Failed to load ${bookId}`, e);
            return null;
        }
    },

    async fetchContentChunk(bookId, chunkIdx) {
        // [FIX] Dùng key khớp với tên file (an1_chunk_0) để đồng bộ với Offline Loader
        const cacheKey = `${bookId}_chunk_${chunkIdx}`;
        
        if (CACHE.content.has(cacheKey)) return CACHE.content.get(cacheKey);

        if (window.__DB_LOADER__ && window.__DB_LOADER__.getContent) {
            const data = window.__DB_LOADER__.getContent(cacheKey);
            if (data) {
                CACHE.content.set(cacheKey, data);
                return data;
            }
        }

        const url = `assets/db/content/${cacheKey}.json`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const data = await resp.json();
            CACHE.content.set(cacheKey, data);
            return data;
        } catch (e) {
            logger.warn("fetchContent", `Failed to load chunk ${cacheKey}`, e);
            return null;
        }
    },

    // ... (Giữ nguyên getMetaEntry, fetchMetaList, downloadAll) ...
    async getMetaEntry(uid, hintBookId = null) {
        let bookId = hintBookId;
        if (!bookId) {
            const loc = this.getLocation(uid);
            if (loc) bookId = loc[0];
        }
        
        if (!bookId) return null;

        const bookMeta = await this.fetchMeta(bookId);
        if (!bookMeta || !bookMeta.meta) return null;

        const entry = bookMeta.meta[uid];
        if (entry) {
            entry._book_id = bookId;
            entry._root_title = bookMeta.super_book_title || bookMeta.title;
            entry._tree = bookMeta.tree;
        }
        return entry;
    },

    async fetchMetaList(uids) {
        const result = {};
        const booksToFetch = new Set();
        
        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) booksToFetch.add(loc[0]);
        });

        const promises = Array.from(booksToFetch).map(bookId => this.fetchMeta(bookId));
        await Promise.all(promises);

        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) {
                const bookId = loc[0];
                const bookData = CACHE.meta.get(bookId);
                if (bookData && bookData.meta && bookData.meta[uid]) {
                    result[uid] = bookData.meta[uid];
                }
            }
        });

        return result;
    },

    async downloadAll(onProgress) {
        await this.init(); 
        if (!CACHE.index) {
            logger.error("DownloadAll", "Index not loaded");
            return;
        }
        logger.info("DownloadAll", "Scanning index for assets...");
        
        const metaSet = new Set();
        const contentSet = new Set();

        Object.values(CACHE.index).forEach(loc => {
            if (!loc) return;
            const [bookId, chunkIdx] = loc;
            metaSet.add(bookId);
            if (chunkIdx !== null) {
                contentSet.add(`${bookId}_chunk_${chunkIdx}`);
            }
        });

        const tasks = [];
        metaSet.forEach(bookId => {
            tasks.push(`assets/db/meta/${bookId}.json`);
        });
        contentSet.forEach(key => {
            tasks.push(`assets/db/content/${key}.json`);
        });

        logger.info("DownloadAll", `Found ${tasks.length} files to sync.`);

        const CONCURRENCY_LIMIT = 5;
        let completed = 0;
        let hasError = false;

        const processTask = async (url) => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            } catch (e) {
                logger.warn("DownloadAll", `Failed: ${url}`, e);
                hasError = true;
            } finally {
                completed++;
                if (onProgress) onProgress(completed, tasks.length);
            }
        };

        const queue = [...tasks];
        const activeWorkers = [];

        while (queue.length > 0 || activeWorkers.length > 0) {
            while (queue.length > 0 && activeWorkers.length < CONCURRENCY_LIMIT) {
                const url = queue.shift();
                const worker = processTask(url).then(() => {
                    activeWorkers.splice(activeWorkers.indexOf(worker), 1);
                });
                activeWorkers.push(worker);
            }
            if (activeWorkers.length > 0) {
                await Promise.race(activeWorkers);
            }
        }

        if (hasError) {
            throw new Error("Some files failed to download.");
        }
        logger.info("DownloadAll", "Sync completed successfully.");
    }
};