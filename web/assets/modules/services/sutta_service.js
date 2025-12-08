// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { PRIMARY_BOOKS, SUB_BOOKS, SUTTA_COUNTS } from '../data/constants.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    
    // Khởi tạo Service (và Repository bên dưới)
    async init() {
        await SuttaRepository.init();
    },

    // --- THUẬT TOÁN RANDOM (2-STEP WEIGHTED) ---
    async getRandomPayload(activeFilters) {
        // 1. Chuẩn bị danh sách sách (Candidates)
        const rootBooks = (!activeFilters || activeFilters.length === 0) ? PRIMARY_BOOKS : activeFilters;
        
        // Mở rộng (Flatten) các sách gộp: an -> an1, an2...
        let candidates = [];
        rootBooks.forEach(bookId => {
            if (SUB_BOOKS[bookId]) {
                candidates.push(...SUB_BOOKS[bookId]);
            } else {
                candidates.push(bookId);
            }
        });

        // 2. Tính tổng trọng số (Total Weight) dựa trên số lượng bài kinh
        let totalWeight = 0;
        const weightedCandidates = [];

        candidates.forEach(bookId => {
            const count = SUTTA_COUNTS[bookId] || 0;
            if (count > 0) {
                totalWeight += count;
                weightedCandidates.push({ id: bookId, weight: count });
            }
        });

        if (totalWeight === 0) return null;

        // 3. Chọn Sách (Weighted Random)
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

        // 4. Tải Meta và Chọn Bài (Uniform Random trong sách đó)
        const bookMeta = await SuttaRepository.fetchMeta(targetBook);
        
        if (!bookMeta || !bookMeta.random_pool || bookMeta.random_pool.length === 0) {
            logger.warn("Random", `Book ${targetBook} has empty random pool.`);
            return null;
        }

        const randomIdx = Math.floor(Math.random() * bookMeta.random_pool.length);
        const targetUid = bookMeta.random_pool[randomIdx];
        const metaEntry = bookMeta.meta[targetUid];
        
        // 5. Trả về Payload đầy đủ (Kèm gợi ý Chunk để Fast Path)
        return {
            uid: targetUid,
            book_id: targetBook,
            chunk: metaEntry ? metaEntry.chunk : null, // Chunk Hint
            meta: metaEntry,
            bookMeta: bookMeta
        };
    },

    // --- LOGIC TẢI BÀI KINH (CORE) ---
    // Input có thể là String ID (từ URL) hoặc Object (từ Random)
    async loadSutta(input) {
        let uid, hintChunk = null, hintBook = null;

        if (typeof input === 'object') {
            // Fast Path: Đã có thông tin từ bước Random
            uid = input.uid;
            hintChunk = input.chunk;
            hintBook = input.book_id;
        } else {
            // Standard Path: Chỉ có ID
            uid = input;
        }

        // 1. Xác định vị trí (Locate)
        // Nếu chưa biết sách nào/chunk nào, phải tra cứu Index
        if (hintBook === null || hintChunk === null) {
            let loc = SuttaRepository.getLocation(uid);
            
            // [FIX RACE CONDITION] Nếu Index chưa tải xong, hãy đợi
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

        // 2. Tải song song Meta & Content (Parallel Fetch)
        const promises = [SuttaRepository.fetchMeta(hintBook)];
        
        // Nếu hintChunk khác null, tải content. Nếu null (Branch), chỉ tải Meta.
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, contentChunk] = await Promise.all(promises);
        if (!bookMeta) return null;

        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 3. Xử lý Alias (Redirect)
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        // 4. Trích xuất Nội dung
        let content = null;
        if (contentChunk) {
            // Case A: Bài thường (Leaf)
            if (contentChunk[uid]) {
                content = contentChunk[uid];
            } 
            // Case B: Bài con (Subleaf) - Cần trích từ cha
            else if (metaEntry.parent_uid && contentChunk[metaEntry.parent_uid]) {
                const parentContent = contentChunk[metaEntry.parent_uid];
                const extractKey = metaEntry.extract_id || uid;
                content = SuttaExtractor.extract(parentContent, extractKey);
            }
        }

        // 5. Tải thông tin Nav (Cho nút Prev/Next)
        const nav = metaEntry.nav || {};
        const neighborsToFetch = [];
        if (nav.prev) neighborsToFetch.push(nav.prev);
        if (nav.next) neighborsToFetch.push(nav.next);

        let navMeta = {};
        if (neighborsToFetch.length > 0) {
            // Tải meta của các bài lân cận để hiển thị Title
            navMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
        }

        // 6. Trả về kết quả cuối cùng cho Controller
        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            
            // Context cho Breadcrumb/Menu
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            tree: bookMeta.tree,
            bookStructure: bookMeta.tree, // Alias cho renderer dễ dùng
            contextMeta: bookMeta.meta,   // Full meta map của sách (để vẽ menu con)
            
            nav: nav,
            navMeta: navMeta
        };
    }
};