// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { PRIMARY_BOOKS, SUB_BOOKS, SUTTA_COUNTS } from '../data/constants.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

// --- [MEMORY CACHE SYSTEM] ---
// 1. Cache trọng số để không phải tính lại mỗi lần bấm
let _cachedWeightedMap = null; 
let _lastFiltersHash = "";

// 2. Cache danh sách ID (Pool) đã bóc tách từ file Meta
// Key: bookId (ví dụ 'mn'), Value: Array<string> (['mn1', 'mn2'...])
const _poolRamCache = new Map(); 

export const SuttaService = {
    
    async init() {
        await SuttaRepository.init();
        // Warm-up: Tính sẵn weight mặc định ngay khi app chạy
        this._getOrBuildWeightedMap([]);
    },

    // --- [HELPER] QUẢN LÝ WEIGHTED MAP ---
    _getFiltersHash(activeFilters) {
        if (!activeFilters || activeFilters.length === 0) return "ALL";
        return activeFilters.slice().sort().join("|");
    },

    _getOrBuildWeightedMap(activeFilters) {
        const currentHash = this._getFiltersHash(activeFilters);
        
        // Nếu filter không đổi -> Dùng lại kết quả cũ (Siêu nhanh)
        if (_cachedWeightedMap && _lastFiltersHash === currentHash) {
            return _cachedWeightedMap;
        }

        // Nếu có thay đổi, tính toán lại
        const rootBooks = (!activeFilters || activeFilters.length === 0) ?
            PRIMARY_BOOKS : activeFilters;
        
        let candidates = [];
        for (const bookId of rootBooks) {
            if (SUB_BOOKS[bookId]) {
                // Dùng vòng lặp for-of thay vì spread (...) để tiết kiệm bộ nhớ trên mobile
                for (const sub of SUB_BOOKS[bookId]) {
                    candidates.push(sub);
                }
            } else {
                candidates.push(bookId);
            }
        }

        let totalWeight = 0;
        const weightedCandidates = [];

        for (const bookId of candidates) {
            const count = SUTTA_COUNTS[bookId] || 0;
            if (count > 0) {
                totalWeight += count;
                weightedCandidates.push({ id: bookId, weight: count });
            }
        }

        _cachedWeightedMap = { totalWeight, weightedCandidates };
        _lastFiltersHash = currentHash;
        
        return _cachedWeightedMap;
    },

    // --- [HELPER] LẤY POOL TỪ RAM HOẶC FETCH ---
    async _getPoolForBook(bookId) {
        // BƯỚC 1: Kiểm tra RAM (Zero latency)
        if (_poolRamCache.has(bookId)) {
            return _poolRamCache.get(bookId);
        }

        // BƯỚC 2: Nếu chưa có, tải file Meta gốc (như cũ)
        // Lưu ý: File này có thể đã được Browser Cache (Service Worker) nên tải rất nhanh,
        // nhưng ta cần tránh việc JSON.parse nó nhiều lần.
        const bookMeta = await SuttaRepository.fetchMeta(bookId);
        
        if (bookMeta && bookMeta.random_pool) {
            // Lưu ngay vào RAM để lần sau dùng
            _poolRamCache.set(bookId, bookMeta.random_pool);
            return bookMeta.random_pool;
        }
        
        return [];
    },

    // --- LOGIC RANDOM CHÍNH ---
    async getRandomPayload(activeFilters) {
        // 1. Chọn Sách (Dùng Cache Weight)
        const { totalWeight, weightedCandidates } = this._getOrBuildWeightedMap(activeFilters);

        if (totalWeight === 0) return null;

        let randomVal = Math.floor(Math.random() * totalWeight);
        let targetBook = null;

        for (const item of weightedCandidates) {
            if (randomVal < item.weight) {
                targetBook = item.id;
                break;
            }
            randomVal -= item.weight;
        }

        logger.info("Random", `Selected Book: ${targetBook}`);

        // 2. Lấy danh sách bài (Dùng Cache Pool)
        // Đây là chỗ cải thiện tốc độ chính: 
        // Thay vì tải toàn bộ object Meta nặng nề, ta chỉ lấy mảng ID từ RAM.
        const randomPool = await this._getPoolForBook(targetBook);
        
        if (!randomPool || randomPool.length === 0) {
            logger.warn("Random", `Book ${targetBook} has empty pool.`);
            return null;
        }

        // 3. Chọn ngẫu nhiên ID
        const randomIdx = Math.floor(Math.random() * randomPool.length);
        const targetUid = randomPool[randomIdx];
        
        // 4. Trả về kết quả
        // Lưu ý: Ta KHÔNG trả về `meta` ở đây nữa vì ta chưa cần tải chi tiết.
        // `loadSutta` sẽ lo việc tải chi tiết sau. Điều này giúp UI phản hồi ngay lập tức.
        return {
            uid: targetUid,
            book_id: targetBook
        };
    },

    // --- LOGIC TẢI BÀI KINH (GIỮ NGUYÊN LOGIC CŨ, CHỈ CHỈNH INPUT) ---
    async loadSutta(input) {
        let uid, hintChunk = null, hintBook = null;

        if (typeof input === 'object') {
            uid = input.uid;
            hintChunk = input.chunk || null;
            hintBook = input.book_id || null;
        } else {
            uid = input;
        }

        // 1. Locate (Nếu thiếu hint từ bước Random, tra cứu Index)
        if (hintBook === null || hintChunk === null) {
            let loc = SuttaRepository.getLocation(uid);
            
            // Fix race condition: Đợi index nếu chưa tải xong
            if (!loc) {
                await SuttaRepository.ensureIndex();
                loc = SuttaRepository.getLocation(uid);
            }

            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        // 2. Fetch Data (Meta + Content)
        // Lúc này mới thực sự tải file nặng, nhưng UI đã chuyển cảnh nên người dùng
        // sẽ thấy loading spinner thay vì cảm giác "đơ" nút bấm.
        const promises = [SuttaRepository.fetchMeta(hintBook)];

        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, contentChunk] = await Promise.all(promises);
        if (!bookMeta) return null;

        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // Nếu chưa có trong Cache RAM, tiện thể lưu luôn để lần sau Random nhanh hơn
        if (!_poolRamCache.has(hintBook) && bookMeta.random_pool) {
             _poolRamCache.set(hintBook, bookMeta.random_pool);
        }

        // 3. Xử lý Alias
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        // 4. Trích xuất Content
        let content = null;
        if (contentChunk) {
            if (contentChunk[uid]) {
                content = contentChunk[uid];
            } 
            else if (metaEntry.parent_uid && contentChunk[metaEntry.parent_uid]) {
                const parentContent = contentChunk[metaEntry.parent_uid];
                const extractKey = metaEntry.extract_id || uid;
                content = SuttaExtractor.extract(parentContent, extractKey);
            }
        }

        // 5. Nav
        const nav = metaEntry.nav || {};
        const neighborsToFetch = [];
        if (nav.prev) neighborsToFetch.push(nav.prev);
        if (nav.next) neighborsToFetch.push(nav.next);

        let navMeta = {};
        if (neighborsToFetch.length > 0) {
            navMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
        }

        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            tree: bookMeta.tree,
            bookStructure: bookMeta.tree,
            contextMeta: bookMeta.meta,
            nav: nav,
            navMeta: navMeta
        };
    }
};