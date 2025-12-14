// Path: web/assets/modules/ui/components/popup/controllers/restoration_controller.js
import { PopupState } from '../state/popup_state.js';
import { CommentController } from './comment_controller.js';
import { QuicklookController } from './quicklook_controller.js';
import { Scroller } from 'ui/common/scroller.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("RestorationCtrl");

export const RestorationController = {
    restore() {
        const snapshot = PopupState.getSnapshot();
        
        if (!snapshot) {
            logger.debug("Restore", "No snapshot found.");
            return;
        }

        // [CRITICAL FIX] Bỏ qua kiểm tra snapshot.type === 'none'
        // Vì trong một số trường hợp race condition, type có thể bị reset về 'none' 
        // nhưng dữ liệu (commentIndex, url) vẫn còn lưu trong snapshot.
        // Chúng ta ưu tiên phục hồi dữ liệu nếu nó tồn tại.
        
        logger.info("Exec", `Analyzing snapshot...`, snapshot);

        let restoredAnything = false;

        // 1. Phục hồi Comment (Lớp dưới)
        // Kiểm tra kỹ: phải là số và không phải -1
        if (typeof snapshot.commentIndex === 'number' && snapshot.commentIndex !== -1) {
            
            // Đảm bảo dữ liệu comment đã được quét
            if (PopupState.getComments().length === 0) {
                logger.info("Restore", "Rescanning comments...");
                CommentController.scanComments();
            }
            
            const comments = PopupState.getComments();
            // Double check index hợp lệ
            if (snapshot.commentIndex < comments.length) {
                logger.info("Restore", `Restoring Comment at index: ${snapshot.commentIndex}`);
                
                // Activate Comment (UI)
                CommentController.activate(snapshot.commentIndex);
                restoredAnything = true;

                // Scroll trang chính tới vị trí cũ (nếu cần thiết)
                const item = comments[snapshot.commentIndex];
                if (item && item.id) {
                    // Dùng 'instant' để tránh hiệu ứng cuộn gây chóng mặt khi restore
                    Scroller.scrollToId(item.id, 'instant'); 
                }
            }
        }

        // 2. Phục hồi Quicklook (Lớp trên - Đè lên comment nếu có)
        // Kiểm tra: quicklookUrl phải tồn tại và không rỗng
        if (snapshot.quicklookUrl) {
            logger.info("Restore", `Restoring Quicklook: ${snapshot.quicklookUrl}`);
            
            // Gọi hàm mở Quicklook với cờ isRestoring = true (nếu controller hỗ trợ logic riêng)
            QuicklookController.handleLinkRequest(snapshot.quicklookUrl, true);
            restoredAnything = true;
        }

        if (!restoredAnything) {
            logger.debug("Restore", "Snapshot had no actionable data.");
        }
    }
};