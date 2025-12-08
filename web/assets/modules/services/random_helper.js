// Path: web/assets/modules/services/random_helper.js
import { PRIMARY_BOOKS, SUB_BOOKS, RANDOM_POOLS } from '../data/constants.js'; 
import { getLogger } from '../utils/logger.js';

const logger = getLogger("RandomHelper");

export const RandomHelper = {
    // Init rỗng để giữ interface, thực tế không cần làm gì
    init() {},

    // Hàm chọn ngẫu nhiên siêu tốc (Virtual Merge)
    getRandomPayloadSync(activeFilters) {
        // 1. Xác định danh sách sách cần random
        const rootBooks = (!activeFilters || activeFilters.length === 0) ?
            PRIMARY_BOOKS : activeFilters;
        
        // Mở rộng sách con (Flatten: an -> an1, an2...)
        // Dùng Set để tránh trùng lặp nếu có lỗi logic ở đâu đó
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
        // (Đây chính là logic "Gộp ảo" thay vì gộp mảng thật)
        for (const book of availableBooks) {
            if (randomTicket < book.count) {
                // Trúng sách này -> Lấy ID tại vị trí vé số
                const targetUid = RANDOM_POOLS[book.id][randomTicket];
                
                logger.info("Random", `Selected: ${targetUid} from ${book.id}`);
                
                return {
                    uid: targetUid,
                    book_id: book.id
                };
            }
            // Không trúng sách này -> Trừ đi số lượng sách này và kiểm tra sách kế tiếp
            randomTicket -= book.count;
        }

        return null; // Should not happen
    },

    // Wrapper Async
    async getRandomPayload(activeFilters) {
        return this.getRandomPayloadSync(activeFilters);
    }
};