// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../shared/logger.js';
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DB");

class DatabaseManager {
    constructor() {
        this.index = null;
        this.structureCache = new Map();
        this.contentCache = new Map();
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        try {
            const response = await fetch('assets/db/uid_index.json');
            if (!response.ok) throw new Error("Could not load uid_index.json");
            this.index = await response.json();
            this.isInitialized = true;
        } catch (e) {
            logger.error("init", "Critical: Failed to load DB Index", e);
            throw e;
        }
    }

    _getLocator(uid) {
        return this.index.locator[uid];
    }

    _resolveStructureName(chunkName) {
        // Từ chunk "sutta_mn_chunk_1" -> "sutta_mn_struct"
        return chunkName.replace(/_chunk_\d+$/, '_struct');
    }

    async fetchStructure(structName) {
        // [FIX] Xử lý trường hợp structName có prefix "structure/" (từ super book)
        // Ví dụ: "structure/super_struct" -> Clean thành "super_struct" để cache key đẹp hơn
        // Nhưng đường dẫn fetch phải đúng.
        
        const cleanName = structName.replace(/^structure\//, '');
        if (this.structureCache.has(cleanName)) return this.structureCache.get(cleanName);

        // Nếu structName đã chứa "structure/", dùng nguyên. Nếu chưa, thêm vào.
        // Tuy nhiên, logic backend hiện tại:
        // - Leaf locator: "sutta_mn_chunk_1"
        // - Branch locator: "sutta_mn_struct"
        // - Super locator: "structure/super_struct"
        
        // Để an toàn, ta luôn fetch từ thư mục structure/
        const url = `assets/db/structure/${cleanName}.json`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.structureCache.set(cleanName, data);
            return data;
        } catch (e) {
            logger.error("fetchStructure", `Failed to load ${structName}`, e);
            return null;
        }
    }

    async fetchContentChunk(chunkName) {
        if (this.contentCache.has(chunkName)) return this.contentCache.get(chunkName);
        const url = `assets/db/content/${chunkName}.json`;
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

    async getSutta(uid) {
        await this.init();
        
        const locator = this._getLocator(uid);
        if (!locator) {
            logger.warn("getSutta", `UID not found in index: ${uid}`);
            return null;
        }

        // --- CASE 1: BRANCH / ROOT ---
        // Dấu hiệu: Locator chứa "_struct" hoặc bắt đầu bằng "structure/"
        if (locator.includes('_struct') || locator.startsWith('structure/')) {
            logger.info("getSutta", `Loading Branch: ${uid} -> ${locator}`);
            
            // Chỉ tải file Structure, KHÔNG tải Content
            const structData = await this.fetchStructure(locator);
            if (!structData) return null;

            return {
                uid: uid,
                isBranch: true,
                meta: structData.meta,        // Chứa info của Branch (Vagga/Book)
                bookStructure: structData.structure // Tree mục lục
            };
        }

        // --- CASE 2: LEAF / SHORTCUT ---
        // Dấu hiệu: Locator là tên chunk (VD: sutta_mn_chunk_1)
        const chunkName = locator;
        const structName = this._resolveStructureName(chunkName);

        // Tải cả 2
        const [structData, chunkData] = await Promise.all([
            this.fetchStructure(structName),
            this.fetchContentChunk(chunkName)
        ]);

        if (!structData || !chunkData) return null;

        // [LOGIC MERGE META]
        // 1. Lấy Meta từ Structure (Slim - dùng cho Nav)
        const combinedMeta = { ...structData.meta };
        
        // 2. Gộp Meta từ Chunk (Full - dùng cho Title chính)
        if (chunkData) {
            Object.keys(chunkData).forEach(key => {
                if (chunkData[key].meta) {
                    combinedMeta[key] = chunkData[key].meta;
                }
            });
        }

        let itemData = chunkData[uid]; 
        
        // Fallback Shortcut
        let targetContent = itemData ? itemData.content : null;
        // Lấy meta từ itemData (ưu tiên) hoặc từ combined (nếu là shortcut ảo)
        let myMeta = itemData ? itemData.meta : combinedMeta[uid];

        if (myMeta && myMeta.type === 'shortcut') {
            const parentUid = myMeta.parent_uid;
            if (chunkData[parentUid]) {
                targetContent = chunkData[parentUid].content;
            }
        }

        return {
            uid: uid,
            isBranch: false,
            content: targetContent,
            meta: combinedMeta,
            bookStructure: structData.structure
        };
    }

    getPool(type = 'primary') {
        if (!this.index) return [];
        if (type === 'primary') {
            let pool = [];
            PRIMARY_BOOKS.forEach(bookId => {
                const bookPool = this.index.pools.books[bookId];
                if (bookPool) pool = pool.concat(bookPool);
            });
            return pool;
        } else {
            return this.index.pools.books[type] || [];
        }
    }
}

export const DB = new DatabaseManager();