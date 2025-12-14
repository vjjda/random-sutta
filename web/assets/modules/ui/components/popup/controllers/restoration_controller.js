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
        
        // Debug Log
        if (snapshot) {
            logger.info("Restore", `Found snapshot type: ${snapshot.type}`, snapshot);
        } else {
            logger.debug("Restore", "No snapshot found.");
            return;
        }

        if (snapshot.type === 'none') return;

        // 1. Luôn restore comment nền nếu có index hợp lệ
        if (typeof snapshot.commentIndex === 'number' && snapshot.commentIndex !== -1) {
            // Đảm bảo dữ liệu comment đã được quét
            if (PopupState.getComments().length === 0) {
                logger.info("Restore", "Rescanning comments...");
                CommentController.scanComments();
            }
            
            logger.info("Restore", `Activating comment index: ${snapshot.commentIndex}`);
            // Activate Comment (UI)
            CommentController.activate(snapshot.commentIndex);
            
            // Scroll trang chính tới vị trí cũ
            const comments = PopupState.getComments();
            if (comments[snapshot.commentIndex]) {
                const item = comments[snapshot.commentIndex];
                if (item && item.id) {
                    // Dùng 'instant' để tránh hiệu ứng cuộn gây chóng mặt khi restore
                    Scroller.scrollToId(item.id, 'instant'); 
                }
            }
        }

        // 2. Nếu type là Quicklook, restore đè lên
        if (snapshot.type === 'quicklook' && snapshot.quicklookUrl) {
            logger.info("Restore", `Re-opening Quicklook: ${snapshot.quicklookUrl}`);
            // isRestoring = true
            QuicklookController.handleLinkRequest(snapshot.quicklookUrl, true);
        }
    }
};