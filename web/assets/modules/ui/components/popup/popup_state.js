// Path: web/assets/modules/ui/components/popup/popup_state.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PopupState");

export const PopupState = {
    // --- RUNTIME MEMORY ---
    // Cache danh sách comment của trang hiện tại (để không phải quét DOM liên tục)
    comments: [],     
    
    // Trạng thái đang active trong phiên làm việc này
    activeType: 'none', // 'comment' | 'quicklook' | 'none'
    activeIndex: -1,    // Dùng cho Comment
    activeUrl: null,    // Dùng cho Quicklook
    
    // Lock để tránh race condition khi fetch dữ liệu
    loadingUid: null, 

    // --- HELPER METHODS ---

    setComments(list) {
        this.comments = list || [];
    },

    getComments() {
        return this.comments;
    },

    setCommentActive(index) {
        this.activeType = 'comment';
        this.activeIndex = index;
        this.activeUrl = null;
    },

    setQuicklookActive(url) {
        this.activeType = 'quicklook';
        this.activeUrl = url;
        // Giữ nguyên activeIndex của comment bên dưới (nếu có) để khi đóng Quicklook thì restore lại được
    },

    clearActive() {
        this.activeType = 'none';
        // Không reset activeIndex/activeUrl ngay để có thể restore nếu cần undo, 
        // nhưng về mặt logic save thì coi như đóng.
    },

    /**
     * [CORE] Lưu trạng thái hiện tại vào History của trình duyệt.
     * Gọi hàm này NGAY TRƯỚC KHI chuyển trang (unload/navigate).
     */
    saveSnapshot() {
        try {
            const currentState = window.history.state || {};
            
            // Snapshot chỉ quan tâm cái gì đang hiển thị "trên cùng"
            // Tuy nhiên, nếu Quicklook đang mở, ta cũng nên lưu comment index nền
            const snapshot = {
                type: this.activeType,
                commentIndex: this.activeIndex,
                quicklookUrl: this.activeUrl
            };

            logger.info("Snapshot", `Saving: ${snapshot.type}`, snapshot);
            
            // Ghi đè state của trang HIỆN TẠI (trước khi rời đi)
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
     * [CORE] Đọc trạng thái từ History (dùng khi trang vừa load lại do Back/Forward).
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
    }
};