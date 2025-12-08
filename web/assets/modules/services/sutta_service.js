// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js'; // [NEW]
import { PRIMARY_BOOKS, SUB_BOOKS, SUTTA_COUNTS } from '../data/constants.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    
    async init() {
        await SuttaRepository.init();
    },

    // --- RANDOM LOGIC (Giữ nguyên từ lần trước) ---
    async getRandomPayload(activeFilters) {
        const rootBooks = (!activeFilters || activeFilters.length === 0) ? PRIMARY_BOOKS : activeFilters;
        let candidates = [];
        rootBooks.forEach(bookId => {
            if (SUB_BOOKS[bookId]) candidates.push(...SUB_BOOKS[bookId]);
            else candidates.push(bookId);
        });

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

        let randomVal = Math.floor(Math.random() * totalWeight);
        let targetBook = null;
        for (const item of weightedCandidates) {
            if (randomVal < item.weight) {
                targetBook = item.id;
                break;
            }
            randomVal -= item.weight;
        }

        const bookMeta = await SuttaRepository.fetchMeta(targetBook);
        if (!bookMeta || !bookMeta.random_pool || bookMeta.random_pool.length === 0) return null;

        const randomIdx = Math.floor(Math.random() * bookMeta.random_pool.length);
        const targetUid = bookMeta.random_pool[randomIdx];
        const metaEntry = bookMeta.meta[targetUid];
        
        return {
            uid: targetUid,
            book_id: targetBook,
            chunk: metaEntry ? metaEntry.chunk : null,
            meta: metaEntry,
            bookMeta: bookMeta
        };
    },

    // --- LOAD LOGIC (Cập nhật xử lý Subleaf & Nav Meta) ---
    async loadSutta(input) {
        let uid, hintChunk = null, hintBook = null;

        if (typeof input === 'object') {
            uid = input.uid;
            hintChunk = input.chunk;
            hintBook = input.book_id;
        } else {
            uid = input;
        }

        // 1. Locate
        if (hintBook === null || hintChunk === null) {
            const loc = SuttaRepository.getLocation(uid);
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        // 2. Fetch Meta & Content
        const promises = [SuttaRepository.fetchMeta(hintBook)];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, contentChunk] = await Promise.all(promises);
        if (!bookMeta) return null;

        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 3. Alias Redirect
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        // 4. Content Resolution (FIX QUAN TRỌNG)
        let content = null;
        if (contentChunk) {
            // Case A: Nội dung nằm trực tiếp (Leaf thường)
            if (contentChunk[uid]) {
                content = contentChunk[uid];
            } 
            // Case B: Nội dung nằm trong cha (Subleaf)
            else if (metaEntry.parent_uid && contentChunk[metaEntry.parent_uid]) {
                const parentContent = contentChunk[metaEntry.parent_uid];
                // Dùng extract_id để cắt đúng đoạn cần thiết
                // Nếu không có extract_id (hiếm), dùng uid làm fallback
                const extractKey = metaEntry.extract_id || uid;
                content = SuttaExtractor.extract(parentContent, extractKey);
            }
        }

        // 5. Fetch Nav Meta (Để hiển thị Title cho nút Prev/Next)
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
            
            // Context
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            tree: bookMeta.tree,
            
            nav: nav,
            navMeta: navMeta // [UPDATED] Đã có dữ liệu title cho nút điều hướng
        };
    }
};