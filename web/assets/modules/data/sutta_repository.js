// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

// Cache In-Memory (Tránh fetch lại những thứ đã tải)
const CACHE = {
    meta: new Map(),    // book_id -> json
    content: new Map(), // chunk_id -> json
    index: null         // uid_index
};

export const SuttaRepository = {
    async init() {
        if (CACHE.index) return;
        
        // 1. Check Offline Global Variable (Do build system inject vào)
        if (window.__DB_INDEX__) {
            CACHE.index = window.__DB_INDEX__;
            logger.info("Init", "Loaded Index from Global (Offline Mode)");
            return;
        }

        // 2. Fetch Network
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

    /**
     * Tra cứu vị trí của UID.
     * @returns [book_id, chunk_index] hoặc null
     */
    getLocation(uid) {
        if (!CACHE.index) return null;
        return CACHE.index[uid] || null;
    },

    /**
     * Tải file Meta của một cuốn sách.
     */
    async fetchMeta(bookId) {
        if (CACHE.meta.has(bookId)) return CACHE.meta.get(bookId);

        // Check Offline Global Loader (nếu có)
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
            if (!resp.ok) return null; // Sách không tồn tại
            const data = await resp.json();
            CACHE.meta.set(bookId, data);
            return data;
        } catch (e) {
            logger.warn("fetchMeta", `Failed to load ${bookId}`, e);
            return null;
        }
    },

    /**
     * Tải file Content Chunk.
     */
    async fetchContentChunk(bookId, chunkIdx) {
        const cacheKey = `${bookId}_${chunkIdx}`;
        if (CACHE.content.has(cacheKey)) return CACHE.content.get(cacheKey);

        // Check Offline Global
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

    /**
     * Hàm helper: Lấy thông tin Meta cụ thể của 1 UID
     * (Tự động tải file meta của sách chứa nó nếu chưa có)
     */
    async getMetaEntry(uid, hintBookId = null) {
        let bookId = hintBookId;
        if (!bookId) {
            const loc = this.getLocation(uid);
            if (loc) bookId = loc[0];
        }
        
        if (!bookId) return null;

        const bookMeta = await this.fetchMeta(bookId);
        if (!bookMeta || !bookMeta.meta) return null;

        // Trả về meta của uid, kèm theo tham chiếu gốc đến book (để vẽ breadcrumb)
        const entry = bookMeta.meta[uid];
        if (entry) {
            // Inject context info (quan trọng cho breadcrumb)
            entry._book_id = bookId;
            entry._root_title = bookMeta.root_title || bookMeta.title;
            entry._tree = bookMeta.tree;
        }
        return entry;
    },

    /**
     * Logic Download All cho Offline Manager
     * (Cần cập nhật logic này sau, tạm thời để placeholder để không crash app)
     */
    async downloadAll(onProgress) {
        // TODO: Implement logic duyệt qua constants.js để tải tất cả meta và content
        logger.info("DownloadAll", "Feature pending update for new DB structure");
        if (onProgress) onProgress(100, 100);
    }
};