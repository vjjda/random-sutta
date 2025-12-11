// Path: web/assets/modules/ui/components/filters/filter_state.js
// [FIXED] Đường dẫn import lùi 3 cấp để về modules/data
import { PRIMARY_BOOKS } from '../../../../data/constants.js';

const filterSet = new Set();

export const FilterState = {
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

    // Chế độ Solo: Chỉ giữ 1 cuốn
    setSolo(bookId) {
        filterSet.clear();
        filterSet.add(bookId);
    },

    getActiveList() {
        return Array.from(filterSet);
    },

    generateParam() {
        const active = Array.from(filterSet);
        const defaults = PRIMARY_BOOKS;

        // Nếu tắt hết -> Trả về null (Total Random)
        if (active.length === 0) return null;

        if (active.length !== defaults.length) {
            return active.join(",");
        }

        const activeSetCheck = new Set(active);
        for (let book of defaults) {
            if (!activeSetCheck.has(book)) return active.join(",");
        }
        
        return null;
    }
};