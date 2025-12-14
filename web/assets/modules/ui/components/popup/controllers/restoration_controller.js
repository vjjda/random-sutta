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

        // [CRITICAL STRATEGY] Data Availability Check
        // Do NOT rely on snapshot.type check here (e.g. if type === 'none').
        // Race conditions might reset 'type' to 'none' but valid data persists.
        
        logger.info("Exec", `Analyzing snapshot...`, snapshot);

        let restoredAnything = false;

        // 1. Phục hồi Comment (Lớp dưới)
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

                // Scroll trang chính tới vị trí cũ
                const item = comments[snapshot.commentIndex];
                if (item && item.id) {
                    // [UPDATED] Dùng jumpTo để tránh hiệu ứng cuộn khi restore
                    Scroller.jumpTo(item.id); 
                }
            }
        }

        // 2. Phục hồi Quicklook (Lớp trên - Đè lên comment nếu có)
        if (snapshot.quicklookUrl) {
            logger.info("Restore", `Restoring Quicklook: ${snapshot.quicklookUrl}`);
            
            // Gọi hàm mở Quicklook với cờ isRestoring = true
            QuicklookController.handleLinkRequest(snapshot.quicklookUrl, true);
            restoredAnything = true;
        }

        if (!restoredAnything) {
            logger.debug("Restore", "Snapshot had no actionable data.");
        }
    }
};