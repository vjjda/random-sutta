// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

const CACHE = {
    meta: new Map(),
    content: new Map(),
    index: null
};

export const SuttaRepository = {
    async init() {
        if (CACHE.index) return;
        if (window.__DB_INDEX__) {
            CACHE.index = window.__DB_INDEX__;
            return;
        }
        try {
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            CACHE.index = await resp.json();
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
        const cacheKey = `${bookId}_${chunkIdx}`;
        if (CACHE.content.has(cacheKey)) return CACHE.content.get(cacheKey);

        if (window.__DB_LOADER__ && window.__DB_LOADER__.getContent) {
            const data = window.__DB_LOADER__.getContent(cacheKey);
            if (data) {
                CACHE.content.set(cacheKey, data);
                return data;
            }
        }

        const url = `assets/db/content/${bookId}_chunk_${chunkIdx}.json`;
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
            entry._root_title = bookMeta.root_title || bookMeta.title;
            entry._tree = bookMeta.tree;
        }
        return entry;
    },

    // [NEW] Hàm lấy danh sách Meta cho nhiều UID (Dùng cho Nav Buttons)
    async fetchMetaList(uids) {
        const result = {};
        const booksToFetch = new Set();
        
        // 1. Xác định cần tải sách nào
        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) booksToFetch.add(loc[0]);
        });

        // 2. Tải song song các sách (nếu chưa có trong cache)
        const promises = Array.from(booksToFetch).map(bookId => this.fetchMeta(bookId));
        await Promise.all(promises);

        // 3. Trích xuất thông tin meta
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
        logger.info("DownloadAll", "Feature pending update for new DB structure");
        if (onProgress) onProgress(100, 100);
    }
};