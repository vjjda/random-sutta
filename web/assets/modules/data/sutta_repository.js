// Path: web/assets/modules/data/sutta_repository.js
import { CoreNetwork } from './core_network.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

// Cấu hình đường dẫn dữ liệu
const DB_PATH = "assets/db";

/**
 * Repository chịu trách nhiệm định vị và lấy dữ liệu Sutta.
 * Logic:
 * 1. Online: Dùng Split Index (Hash Bucket) để tìm vị trí.
 * 2. Offline: Dùng Global Index (window.__DB_INDEX__) nếu có.
 */
export const SuttaRepository = {
    
    // --- 1. INITIALIZATION ---
    async init() {
        // Có thể pre-load cái gì đó nếu cần
        logger.info("Init", "Repository ready.");
    },

    // --- 2. CORE RESOLUTION LOGIC ---

    /**
     * Tính toán Bucket ID cho Split Index.
     * Thuật toán: DJB2 Hash (phải khớp với logic Python `_get_bucket_id`).
     * @param {string} uid 
     * @returns {string} Bucket ID (0-19)
     */
    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            // hash * 33 + c
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
            // Force 32-bit unsigned integer
            hash = hash & 0xFFFFFFFF;
        }
        // Đảm bảo số dương trước khi mod
        return String(Math.abs(hash) % 20);
    },

    /**
     * Tìm vị trí của Sutta (Book ID + Chunk Index).
     * @param {string} uid - Ví dụ: "mn1"
     * @returns {Promise<[string, number|null]|null>} [bookId, chunkIdx] hoặc null
     */
    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();

        // ƯU TIÊN 1: Offline Global Index (Injected Variable)
        // Được tạo bởi `offline_converter.py` cho bản build offline
        if (window.__DB_INDEX__) {
            const loc = window.__DB_INDEX__[cleanUid];
            return loc || null;
        }

        // ƯU TIÊN 2: Online Split Index (Lazy Load)
        // Tải file index nhỏ (~20KB) dựa trên hash
        const bucketId = this._getBucketId(cleanUid);
        const indexUrl = `${DB_PATH}/index/${bucketId}.json`;
        
        const bucketData = await CoreNetwork.fetchJson(indexUrl);
        if (bucketData && bucketData[cleanUid]) {
            return bucketData[cleanUid];
        }

        return null;
    },

    // --- 3. DATA FETCHING ---

    /**
     * Lấy Metadata của một cuốn sách (hoặc group).
     * @param {string} bookId - Ví dụ: "mn", "an", "tpk"
     */
    async fetchMeta(bookId) {
        // [OFFLINE MODE] Nếu đã có dữ liệu trong biến toàn cục (do loader script inject)
        if (window.__DB_LOADER__ && window.__DB_LOADER__.getMeta) {
            const memMeta = window.__DB_LOADER__.getMeta(bookId);
            if (memMeta) return memMeta;
        }

        const url = `${DB_PATH}/meta/${bookId}.json`;
        return await CoreNetwork.fetchJson(url);
    },

    /**
     * Lấy Content Chunk chứa nội dung bài kinh.
     * @param {string} bookId 
     * @param {number} chunkIdx 
     */
    async fetchContentChunk(bookId, chunkIdx) {
        // [OFFLINE MODE] Check memory first
        const key = `${bookId}_chunk_${chunkIdx}`;
        if (window.__DB_LOADER__ && window.__DB_LOADER__.getContent) {
            const memContent = window.__DB_LOADER__.getContent(key);
            if (memContent) return memContent;
        }

        const url = `${DB_PATH}/content/${key}.json`;
        return await CoreNetwork.fetchJson(url);
    },

    /**
     * Helper: Fetch nhiều Meta cùng lúc (dùng cho Navigation).
     */
    async fetchMetaList(bookIds) {
        const uniqueIds = [...new Set(bookIds)];
        const results = {};
        
        await Promise.all(uniqueIds.map(async (bid) => {
            const meta = await this.fetchMeta(bid);
            if (meta && meta.meta) {
                // Merge meta entries vào kết quả chung
                Object.assign(results, meta.meta);
            }
        }));
        
        return results;
    },

    // --- 4. OFFLINE SYNC ---

    /**
     * Tải toàn bộ dữ liệu về Cache (cho tính năng "Download Offline").
     * @param {Function} onProgress 
     */
    async downloadAll(onProgress) {
        // 1. Lấy danh sách file từ db_bundle.zip hoặc manifest (ở đây giả lập quét)
        // Vì static hosting không list được file, ta phải dựa vào UID Index để suy luận.
        // Tuy nhiên, cách tốt nhất cho SPA là tải file zip bundle (đã tạo bởi python zip_generator.py)
        
        logger.info("Sync", "Starting Bundle Download...");
        
        // [STRATEGY UPDATE] Thay vì fetch từng file nhỏ, ta fetch file ZIP lớn (db_bundle.zip)
        // và lưu vào Cache Storage. Service Worker sẽ cần logic để serve file từ trong zip (nâng cao),
        // HOẶC đơn giản nhất: Fetch tất cả JSON dựa trên việc duyệt cây (Crawling).
        
        // Ở phiên bản hiện tại, ta sẽ dùng chiến lược Crawling đơn giản qua TPK (Root):
        
        const urlsToCache = [];
        
        // A. Shell Assets (CSS, JS core) - Đã được SW cache lúc install, ta cache lại cho chắc
        urlsToCache.push('assets/modules/data/constants.js');

        // B. Data Assets - Crawl từ Super Tree (TPK)
        try {
            const tpk = await this.fetchMeta('tpk');
            if (tpk) {
                urlsToCache.push(`${DB_PATH}/meta/tpk.json`);
                
                // Helper đệ quy để thu thập ID sách
                const collectBooks = (node, list) => {
                    if (typeof node === 'string') list.push(node);
                    else if (Array.isArray(node)) node.forEach(c => collectBooks(c, list));
                    else if (typeof node === 'object') Object.values(node).forEach(v => collectBooks(v, list));
                };
                
                const books = [];
                collectBooks(tpk.tree, books);
                
                // C. Tạo danh sách URL cần tải
                // 1. Meta Files
                books.forEach(bid => urlsToCache.push(`${DB_PATH}/meta/${bid}.json`));
                
                // 2. Index Files (0-19)
                for (let i = 0; i < 20; i++) {
                    urlsToCache.push(`${DB_PATH}/index/${i}.json`);
                }

                // 3. Content Files (Khó đoán tên chunk nếu không có map)
                // => Giải pháp: Tạm thời chỉ cache Meta và Index để browse offline.
                // Content sẽ được cache thụ động (lazy) khi người dùng đọc (hoặc cần logic phức tạp hơn).
                // [NOTE] Để cache full content, cần một file manifest chứa danh sách tất cả chunk files.
                // Python build system nên sinh ra file `assets/db/manifest.json`.
            }
        } catch (e) {
            logger.error("Sync", "Failed to crawl data", e);
        }

        // Thực hiện cache
        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        await CoreNetwork.cacheBatch(urlsToCache, CACHE_NAME, onProgress);
    }
};