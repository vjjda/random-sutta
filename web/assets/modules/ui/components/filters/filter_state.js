// Path: web/assets/modules/ui/components/filters/filter_state.js
import { PRIMARY_BOOKS } from '../../../../data/constants.js';

// State nội bộ
const filterSet = new Set();

export const FilterState = {
    // Khởi tạo từ URL
    initFromUrl(bParam) {
        filterSet.clear();
        let initialBooks = new Set();

        if (bParam) {
            const booksFromUrl = bParam.toLowerCase().split(",").map((s) => s.trim());
            booksFromUrl.forEach((b) => initialBooks.add(b));
        } else {
            // Mặc định chọn hết Primary
            PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
        }
        
        initialBooks.forEach(b => filterSet.add(b));
    },

    has(bookId) {
        return filterSet.has(bookId);
    },

    add(bookId) {
        filterSet.add(bookId);
    },

    delete(bookId) {
        filterSet.delete(bookId);
    },

    // Chế độ Solo: Xóa hết, chỉ giữ 1
    setSolo(bookId) {
        filterSet.clear();
        filterSet.add(bookId);
    },

    getActiveList() {
        return Array.from(filterSet);
    },

    // Logic tính toán URL Param
    generateParam() {
        const active = Array.from(filterSet);
        const defaults = PRIMARY_BOOKS;

        // Nếu rỗng -> Total Random (trả về null để xóa param)
        if (active.length === 0) return null;

        // Nếu khác mặc định -> Trả về chuỗi
        if (active.length !== defaults.length) {
            return active.join(",");
        }

        // Kiểm tra xem có khác thành phần không
        const activeSetCheck = new Set(active);
        for (let book of defaults) {
            if (!activeSetCheck.has(book)) return active.join(",");
        }
        
        return null; // Giống mặc định -> null
    }
};