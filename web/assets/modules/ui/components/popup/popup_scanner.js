// Path: web/assets/modules/ui/components/popup/popup_scanner.js
import { getCleanTextContent } from 'ui/components/toh/text_utils.js';

export const PopupScanner = {
    /**
     * Quét container để tìm các marker comment.
     * @returns {Array} Danh sách objects comment.
     */
    scan(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        const markers = container.querySelectorAll(".comment-marker");
        return Array.from(markers).map(marker => ({
            id: marker.closest('.segment')?.id, // ID của đoạn văn chứa marker
            text: marker.dataset.comment,       // Nội dung comment
            element: marker.closest('.segment') // Element đoạn văn
        }));
    },

    /**
     * Lấy text ngữ cảnh (đoạn văn) của comment tại index.
     */
    getContextText(comments, index) {
        if (index >= 0 && index < comments.length) {
            const el = comments[index].element;
            if (el) return getCleanTextContent(el);
        }
        return "";
    }
};