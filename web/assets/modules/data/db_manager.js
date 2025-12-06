// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../shared/logger.js';
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DB");

class DatabaseManager {
    constructor() {
        this.index = null;
        this.structureCache = new Map(); // Cache các file _struct.json
        this.contentCache = new Map();   // Cache các file _chunk.json
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            logger.info("init", "Fetching Master Index...");
            const response = await fetch('assets/db/uid_index.json');
            if (!response.ok) throw new Error("Could not load uid_index.json");
            
            this.index = await response.json();
            this.isInitialized = true;
            logger.info("init", `✅ Index loaded. Pools: ${Object.keys(this.index.pools.books).length}`);
        } catch (e) {
            logger.error("init", "Critical: Failed to load DB Index", e);
            throw e;
        }
    }

    /**
     * Lấy locator string từ UID.
     * Xử lý cả shortcut (đã được backend map thẳng vào chunk của cha).
     */
    _getLocator(uid) {
        return this.index.locator[uid];
    }

    /**
     * Từ locator (tên chunk), suy ra tên file structure.
     * Ví dụ: sutta_mn_chunk_1 -> sutta_mn_struct
     */
    _resolveStructureName(chunkName) {
        // Regex: Tìm "_chunk_" và phần số phía sau, thay bằng "_struct"
        return chunkName.replace(/_chunk_\d+$/, '_struct');
    }

    /**
     * Tải file Structure (Metadata & Tree) của một cuốn sách.
     */
    async fetchStructure(structName) {
        if (this.structureCache.has(structName)) {
            return this.structureCache.get(structName);
        }

        const url = `assets/db/structure/${structName}.json`;
        logger.debug("fetchStructure", `Loading: ${url}`);
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            this.structureCache.set(structName, data);
            return data;
        } catch (e) {
            logger.error("fetchStructure", `Failed to load ${structName}`, e);
            return null;
        }
    }

    /**
     * Tải file Content Chunk.
     */
    async fetchContentChunk(chunkName) {
        if (this.contentCache.has(chunkName)) {
            return this.contentCache.get(chunkName);
        }

        const url = `assets/db/content/${chunkName}.json`;
        logger.debug("fetchChunk", `Loading: ${url}`);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            this.contentCache.set(chunkName, data);
            return data;
        } catch (e) {
            logger.error("fetchChunk", `Failed to load ${chunkName}`, e);
            return null;
        }
    }

    /**
     * API CHÍNH: Lấy đầy đủ thông tin bài kinh.
     * Trả về: { content, meta, structure }
     */
    async getSutta(uid) {
        await this.init();
        
        const chunkName = this._getLocator(uid);
        if (!chunkName) {
            logger.warn("getSutta", `UID not found in index: ${uid}`);
            return null;
        }

        const structName = this._resolveStructureName(chunkName);

        // Chạy song song 2 request: Structure (cho Meta) và Content (cho Text)
        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        // Xử lý logic Shortcut
        let targetContent = chunkData[uid];
        let meta = structData.meta[uid];

        // Nếu không tìm thấy content trực tiếp, có thể đây là shortcut
        // (Dù backend đã map locator, nhưng trong chunk chỉ chứa Parent Key)
        if (!targetContent && meta && meta.type === 'shortcut') {
            const parentUid = meta.parent_uid;
            logger.debug("getSutta", `Shortcut detected: ${uid} -> ${parentUid}`);
            targetContent = chunkData[parentUid];
        }

        return {
            uid: uid,
            content: targetContent, // Object chứa pli, eng, html, comm...
            meta: meta,             // Object chứa title, acronym...
            bookStructure: structData.structure // Để render navigation
        };
    }

    /**
     * Lấy danh sách UID để random.
     * Tự động tổng hợp Primary Pool nếu cần.
     */
    getPool(type = 'primary') {
        if (!this.index) return [];

        if (type === 'primary') {
            // [OPTIMIZATION] Tổng hợp on-the-fly từ books
            // Tránh lưu duplicate trong file index.json
            let pool = [];
            PRIMARY_BOOKS.forEach(bookId => {
                const bookPool = this.index.pools.books[bookId];
                if (bookPool) {
                    pool = pool.concat(bookPool);
                }
            });
            return pool;
        } else {
            // Lấy pool cụ thể của một sách (ví dụ: 'dhp')
            return this.index.pools.books[type] || [];
        }
    }
    
    /**
     * Kiểm tra xem sách có tồn tại trong index không (dùng cho Filter)
     */
    hasBook(bookId) {
        return this.index && this.index.pools.books[bookId];
    }
}

export const DB = new DatabaseManager();