// Path: web/assets/modules/ui/components/popup/popup_state.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PopupState");

export const PopupState = {
    // Runtime Data
    comments: [], // Danh sách comment đã quét từ DOM
    currentIndex: -1, // Index comment đang active
    loadingUid: null, // UID đang được fetch (để tránh race condition)

    // --- HELPER METHODS ---

    /**
     * Lưu snapshot hiện tại vào History State.
     * @param {boolean} isQuicklookOpen - Quicklook có đang mở không?
     * @param {string|null} quicklookUrl - URL của Quicklook (nếu có)
     */
    saveSnapshot(isQuicklookOpen, quicklookUrl) {
        try {
            const currentState = window.history.state || {};
            
            // Logic: Comment vẫn được coi là active nếu index hợp lệ, 
            // dù nó đang bị Quicklook che khuất.
            const snapshot = {
                commentIndex: this.currentIndex,
                quicklookUrl: isQuicklookOpen ? quicklookUrl : null
            };

            logger.debug("Snapshot", `Saved: CIdx=${snapshot.commentIndex}, QL=${snapshot.quicklookUrl ? 'Yes' : 'No'}`);
            
            // Ghi đè vào entry hiện tại của Browser History
            window.history.replaceState(
                { ...currentState, popupState: snapshot }, 
                document.title, 
                window.location.href
            );
        } catch (e) {
            logger.error("Snapshot", "Save failed", e);
        }
    },

    /**
     * Lấy snapshot từ History State (dùng khi Back/Forward).
     */
    getSnapshot() {
        try {
            const state = window.history.state;
            if (state && state.popupState) {
                return state.popupState;
            }
        } catch (e) {
            logger.error("Snapshot", "Get failed", e);
        }
        return null;
    },

    resetRuntime() {
        this.currentIndex = -1;
        this.loadingUid = null;
        // Không reset comments[] ở đây vì comments phụ thuộc vào nội dung trang chính,
        // chỉ reset khi trang chính đổi.
    },

    setComments(list) {
        this.comments = list || [];
    },

    hasComments() {
        return this.comments.length > 0;
    }
};