// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { PRIMARY_BOOKS, SUB_BOOKS, SUTTA_COUNTS } from '../data/constants.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    
    // --- KHỞI TẠO ---
    async init() {
        await SuttaRepository.init();
    },

    // --- RANDOM LOGIC (THUẬT TOÁN MỚI) ---
    async getRandomPayload(activeFilters) {
        // 1. Chuẩn bị danh sách sách (Candidates)
        // Nếu không có filter -> Dùng PRIMARY_BOOKS
        const rootBooks = (!activeFilters || activeFilters.length === 0) ? PRIMARY_BOOKS : activeFilters;
        
        // Mở rộng (Flatten): an -> an1, an2...
        let candidates = [];
        rootBooks.forEach(bookId => {
            if (SUB_BOOKS[bookId]) {
                candidates.push(...SUB_BOOKS[bookId]);
            } else {
                candidates.push(bookId);
            }
        });

        // 2. Tính trọng số (Weights)
        let totalWeight = 0;
        const weightedCandidates = [];

        candidates.forEach(bookId => {
            // SUTTA_COUNTS giờ đã có key của an1, an2...
            const count = SUTTA_COUNTS[bookId] || 0;
            if (count > 0) {
                totalWeight += count;
                weightedCandidates.push({ id: bookId, weight: count });
            }
        });

        if (totalWeight === 0) return null;

        // 3. Gieo xúc xắc chọn sách (Weighted Random)
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

        // 4. Tải Meta và Chọn bài (Uniform Random)
        const bookMeta = await SuttaRepository.fetchMeta(targetBook);
        if (!bookMeta || !bookMeta.random_pool || bookMeta.random_pool.length === 0) {
            return null;
        }

        const randomIdx = Math.floor(Math.random() * bookMeta.random_pool.length);
        const targetUid = bookMeta.random_pool[randomIdx];
        
        // 5. [FAST PATH PREPARATION]
        // Lấy sẵn info để trả về cho Controller
        const metaEntry = bookMeta.meta[targetUid];
        const chunkIdx = metaEntry ? metaEntry.chunk : null; // Có thể null nếu là alias/subleaf

        return {
            uid: targetUid,
            book_id: targetBook,
            chunk: chunkIdx,      // Hint cho Fast Path
            meta: metaEntry,      // Hint để render Header ngay
            bookMeta: bookMeta    // Cache sẵn
        };
    },

    // --- LOAD LOGIC (THUẬT TOÁN MỚI) ---
    // Hỗ trợ cả UID String và Payload Object
    async loadSutta(input) {
        let uid, hintChunk = null, hintBook = null;

        if (typeof input === 'object') {
            // Fast Path từ Random
            uid = input.uid;
            hintChunk = input.chunk;
            hintBook = input.book_id;
        } else {
            // Standard Path từ URL
            uid = input;
        }

        // 1. Xác định vị trí (Location)
        // Nếu không có hint, phải tra index
        if (hintBook === null || hintChunk === null) {
            const loc = SuttaRepository.getLocation(uid);
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        // 2. Fetch Parallel (Meta & Content)
        // Nếu là Branch (hintChunk === null), chỉ fetch Meta
        const promises = [SuttaRepository.fetchMeta(hintBook)];
        
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, contentChunk] = await Promise.all(promises);

        if (!bookMeta) return null;

        // 3. Assemble Data
        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // Xử lý Alias (Redirect)
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        // Lấy nội dung
        let content = null;
        if (contentChunk) {
            content = contentChunk[uid];
            
            // Nếu là Subleaf, nội dung có thể nằm ở Parent Container
            // Tuy nhiên, logic Backend mới đã đảm bảo contentChunk chứa đủ nội dung
            // Kể cả subleaf. Nhưng nếu backend gộp chung, ta cần extract.
            if (!content && metaEntry.parent_uid && contentChunk[metaEntry.parent_uid]) {
                // TODO: Logic extract text từ parent (cần SuttaExtractor)
                // Nhưng với backend hiện tại ta đã flatten content rồi, nên content[uid] thường sẽ có.
                // Nếu chưa có, ta sẽ xử lý sau. Tạm thời giả định backend ok.
            }
        }

        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            tree: bookMeta.tree,
            bookStructure: bookMeta.tree, // Alias cho renderer dễ dùng
            
            // [NEW] Truyền toàn bộ meta map để Renderer vẽ menu con
            contextMeta: bookMeta.meta, 
            
            nav: metaEntry.nav || {}
        };
    }
};