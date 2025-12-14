// Path: web/assets/modules/ui/components/popup/popup_state.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PopupState");

export const PopupState = {
    // --- RUNTIME MEMORY (Nguồn chân lý) ---
    // Thay vì lưu rời rạc, ta lưu một object đại diện cho popup đang active
    activePopup: {
        type: 'none', // 'comment' | 'quicklook' | 'none'
        data: null    // { index: 0 } hoặc { url: 'mn1' }
    },

    // Dữ liệu phụ trợ (Cache)
    comments: [],     // Cache danh sách comment của trang hiện tại
    loadingUid: null, // Lock để tránh race condition khi fetch

    // --- STATE SETTERS (Gọi khi UI thay đổi) ---

    setCommentActive(index) {
        this.activePopup = {
            type: 'comment',
            data: { index: index }
        };
    },

    setQuicklookActive(url) {
        this.activePopup = {
            type: 'quicklook',
            data: { url: url }
        };
    },

    clearActive() {
        this.activePopup = { type: 'none', data: null };
    },

    // --- HISTORY API INTERFACE ---

    /**
     * Lưu trạng thái hiện tại (trong RAM) vào History Browser.
     * Được gọi ngay trước khi chuyển trang.
     */
    saveSnapshot() {
        try {
            const currentState = window.history.state || {};
            
            // Chỉ lưu những gì đang thực sự active trong RAM
            const snapshot = {
                type: this.activePopup.type,
                data: this.activePopup.data
            };

            logger.info("Snapshot", `Saving: Type=${snapshot.type}`, snapshot.data);
            
            window.history.replaceState(
                { ...currentState, popupSnapshot: snapshot }, 
                document.title, 
                window.location.href
            );
        } catch (e) {
            logger.error("Snapshot", "Save failed", e);
        }
    },

    /**
     * Lấy snapshot từ History Browser (dùng khi Restore).
     */
    getSnapshot() {
        try {
            const state = window.history.state;
            if (state && state.popupSnapshot) {
                return state.popupSnapshot;
            }
        } catch (e) {
            logger.error("Snapshot", "Get failed", e);
        }
        return null;
    },

    // --- DATA HELPERS ---
    setComments(list) { this.comments = list || []; },
    hasComments() { return this.comments.length > 0; }
};