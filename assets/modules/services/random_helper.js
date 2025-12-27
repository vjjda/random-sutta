// Path: web/assets/modules/services/random_helper.js
import { PRIMARY_BOOKS, SECONDARY_BOOKS, SUB_BOOKS, RANDOM_POOLS } from 'data/constants.js'; // [UPDATED] Import SECONDARY_BOOKS
import { getLogger } from 'utils/logger.js';

const logger = getLogger("RandomHelper");

export const RandomHelper = {
    // Init rỗng để giữ interface
    init() {},

    // Hàm chọn ngẫu nhiên siêu tốc (Virtual Merge)
    getRandomPayloadSync(activeFilters) {
        // 1. Xác định danh sách sách cần random
        // [UPDATED] Nếu không có filter (tắt hết), dùng cả PRIMARY + SECONDARY
        const rootBooks = (!activeFilters || activeFilters.length === 0) 
            ? [...PRIMARY_BOOKS, ...SECONDARY_BOOKS] 
            : activeFilters;
        
        // Mở rộng sách con (Flatten: an -> an1, an2...)
        const targetBookIds = [];
        for (const bookId of rootBooks) {
            if (SUB_BOOKS[bookId]) {
                for (const sub of SUB_BOOKS[bookId]) {
                    targetBookIds.push(sub);
                }
            } else {
                targetBookIds.push(bookId);
            }
        }

        // 2. Tính tổng số lượng bài (Total Count)
        let totalCount = 0;
        const availableBooks = [];

        for (const bid of targetBookIds) {
            const pool = RANDOM_POOLS[bid];
            if (pool && pool.length > 0) {
                totalCount += pool.length;
                availableBooks.push({ id: bid, count: pool.length });
            }
        }

        if (totalCount === 0) return null;

        // 3. Chọn một số ngẫu nhiên trong tổng số
        let randomTicket = Math.floor(Math.random() * totalCount);

        // 4. Tìm xem vé số đó thuộc về sách nào
        for (const book of availableBooks) {
            if (randomTicket < book.count) {
                const targetUid = RANDOM_POOLS[book.id][randomTicket];
                logger.info("Random", `Selected: ${targetUid} from ${book.id}`);
                return {
                    uid: targetUid,
                    book_id: book.id
                };
            }
            randomTicket -= book.count;
        }

        return null;
    },

    async getRandomPayload(activeFilters) {
        return this.getRandomPayloadSync(activeFilters);
    }
};