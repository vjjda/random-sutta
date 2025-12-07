// Path: web/assets/modules/data/db_manager.js
import { getLogger } from '../utils/logger.js'; // [FIXED] Trỏ đúng về utils
import { PRIMARY_BOOKS } from './constants.js';

const logger = getLogger("DBManager");

// [OFFLINE SUPPORT]
// Cơ chế JSONP-like để load file JS offline mà không bị chặn bởi CORS (file://)
// Các file trong assets/db/*.js sẽ gọi window.__DB_LOADER__.receive('key', data)
window.__DB_LOADER__ = {
    cache: {},
    receive: function(key, data) {
        this.cache[key] = data;
    }
};

export const DB = {
    uidIndex: null,
    suttaCache: new Map(),
    structureCache: new Map(),

    async init() {
        if (this.uidIndex) return;

        // 1. Kiểm tra Offline Index (được inject vào window bởi build system)
        if (window.__DB_INDEX__) {
            logger.info("Init", "Using Preloaded Index (Offline Mode)");
            this.uidIndex = window.__DB_INDEX__;
            return;
        }

        // 2. Fetch Online Index
        try {
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error(`Index fetch failed: ${resp.status}`);
            this.uidIndex = await resp.json();
            logger.info("Init", `Index loaded (${Object.keys(this.uidIndex.locator || {}).length} items)`);
        } catch (e) {
            logger.error("Init", "Failed to load index", e);
            throw e;
        }
    },

    /**
     * Lấy danh sách UID thuộc về một book (hoặc pool 'primary').
     */
    getPool(bookId) {
        if (!this.uidIndex || !this.uidIndex.pools) return [];
        
        if (bookId === 'primary') {
            // Tổng hợp từ config PRIMARY_BOOKS
            let combined = [];
            PRIMARY_BOOKS.forEach(bid => {
                const bookPool = this.uidIndex.pools.books[bid] || [];
                combined = combined.concat(bookPool);
            });
            return combined;
        }
        
        // Trả về pool của một sách cụ thể
        return this.uidIndex.pools.books[bookId] || [];
    },

    /**
     * Tải nội dung JSON (hỗ trợ cả Online fetch và Offline loader cache).
     */
    async _fetchResource(path, key) {
        // A. Thử lấy từ Offline Cache trước
        if (window.__DB_LOADER__.cache[key]) {
            return window.__DB_LOADER__.cache[key];
        }

        // B. Fetch qua mạng (Online)
        // Nếu đang ở file:// protocol mà không có cache -> Sẽ lỗi CORS (chấp nhận)
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`Resource 404: ${path}`);
        return await resp.json();
    },

    /**
     * Lấy dữ liệu bài kinh đầy đủ (Content + Meta).
     */
    async getSutta(suttaId) {
        await this.init();

        // Check RAM cache
        if (this.suttaCache.has(suttaId)) {
            return this.suttaCache.get(suttaId);
        }

        // Tìm vị trí file (Locator)
        const locatorKey = this.uidIndex.locator[suttaId];
        if (!locatorKey) {
            logger.warn("getSutta", `Locator not found for ${suttaId}`);
            return null;
        }

        // LocatorKey có dạng: "content/mn_chunk_1" hoặc "structure/super_struct"
        const isStructure = locatorKey.includes("_struct");
        const path = `assets/db/${locatorKey}.js`.replace('.js', '.json'); // Online dùng .json, logic loader tự xử lý
        const resourceKey = locatorKey.split('/').pop(); // Tên file không path

        try {
            const chunkData = await this._fetchResource(path, resourceKey);
            
            // ChunkData chứa nhiều suttas: { "mn1": {...}, "mn2": {...} }
            // Hoặc nếu là shortcut, nó cũng nằm trong đó.
            
            let suttaData = chunkData[suttaId];

            if (!suttaData) {
                // Trường hợp hy hữu: Locator trỏ đúng chunk nhưng trong chunk không có key
                logger.warn("getSutta", `Key ${suttaId} missing in chunk ${resourceKey}`);
                return null;
            }

            // Xử lý Shortcut (nếu đây là shortcut, cần lấy content của parent)
            if (suttaData.meta && suttaData.meta.type === 'shortcut') {
                const parentId = suttaData.meta.parent_uid;
                const parentData = chunkData[parentId]; // Thường shortcut và parent nằm cùng chunk
                
                if (parentData) {
                    // Mượn content của cha, nhưng giữ meta của con
                    suttaData = {
                        ...parentData, // Lấy content, author...
                        meta: {
                            ...parentData.meta, // Lấy base meta cha
                            ...suttaData.meta   // Ghi đè meta con (acronym, title...)
                        },
                        uid: suttaId // Đảm bảo ID là con
                    };
                }
            }

            // Nếu đây là Branch (Structure View), load thêm Book Structure
            if (isStructure) {
                // Với Branch, content chính là cấu trúc sách
                suttaData.bookStructure = chunkData.structure;
                suttaData.isBranch = true;
            } else {
                // Với Leaf, cần load thêm structure của sách chứa nó để làm Nav
                // (Optional: Có thể lazy load sau, nhưng load luôn cho tiện Nav)
                const bookId = suttaId.match(/^[a-z]+/)[0]; // mn1 -> mn
                // Logic tìm structure file của book
                // Thường locator của book structure là "structure/{bookId}_struct"
                // Ta có thể suy diễn hoặc tìm trong locator index một item đại diện
            }
            
            // Format lại dữ liệu chuẩn để Controller dùng
            const result = {
                uid: suttaId,
                content: suttaData.content || null,
                meta: suttaData.meta || {},
                isBranch: !!suttaData.isBranch,
                bookStructure: suttaData.bookStructure || null
            };

            this.suttaCache.set(suttaId, result);
            return result;

        } catch (e) {
            logger.error("getSutta", `Failed to load ${suttaId}`, e);
            return null;
        }
    },

    /**
     * Lấy metadata cho một danh sách UIDs (Dùng cho view Branch để hiển thị list con).
     */
    async fetchMetaForUids(uids) {
        await this.init();
        const result = {};
        const chunksToLoad = new Set();
        const uidToChunk = {};

        // 1. Gom nhóm các UID theo Chunk để fetch tối ưu
        uids.forEach(uid => {
            const loc = this.uidIndex.locator[uid];
            if (loc) {
                chunksToLoad.add(loc);
                uidToChunk[uid] = loc;
            }
        });

        // 2. Fetch các chunks (Parallel)
        const promises = Array.from(chunksToLoad).map(async (loc) => {
            const path = `assets/db/${loc}.json`;
            const key = loc.split('/').pop();
            try {
                const data = await this._fetchResource(path, key);
                return { key: loc, data };
            } catch (e) {
                return { key: loc, data: {} };
            }
        });

        const loadedChunks = await Promise.all(promises);
        const chunkMap = {};
        loadedChunks.forEach(item => chunkMap[item.key] = item.data);

        // 3. Trích xuất meta
        uids.forEach(uid => {
            const loc = uidToChunk[uid];
            if (loc && chunkMap[loc] && chunkMap[loc][uid]) {
                result[uid] = chunkMap[loc][uid].meta;
            }
        });

        return result;
    },

    /**
     * Lấy cấu trúc sách (hoặc Super Struct).
     */
    async fetchStructure(key) {
        // key ví dụ: 'super_struct' hoặc 'mn_struct'
        const loc = `structure/${key}`;
        const path = `assets/db/${loc}.json`;
        try {
            return await this._fetchResource(path, key);
        } catch (e) {
            logger.warn("fetchStructure", `Failed ${key}`);
            return null;
        }
    },

    /**
     * Download toàn bộ DB để cache vào Service Worker.
     */
    async downloadAll(onProgress) {
        await this.init();
        
        // Lấy tất cả các locator (file chunks)
        const allLocators = new Set(Object.values(this.uidIndex.locator));
        // Thêm các file structure cơ bản nếu chưa có trong locator
        allLocators.add("structure/super_struct");

        const total = allLocators.size;
        let current = 0;
        
        logger.info("DownloadAll", `Starting download of ${total} chunks...`);

        // Chunking requests để tránh nghẽn mạng (batch size = 5)
        const items = Array.from(allLocators);
        const batchSize = 5;
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await Promise.all(batch.map(async (loc) => {
                const path = `assets/db/${loc}.json`;
                try {
                    await fetch(path); // Chỉ cần fetch để SW bắt và cache
                } catch (e) {
                    // Ignore error, SW might handled it or net failed
                }
            }));
            
            current += batch.length;
            if (onProgress) onProgress(Math.min(current, total), total);
        }
        
        logger.info("DownloadAll", "Completed.");
    }
};