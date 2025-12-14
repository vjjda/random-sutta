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
        // Kiểm tra hợp lệ: type phải khác 'none'
        if (!snapshot || snapshot.type === 'none') return;

        logger.info("Exec", `Type: ${snapshot.type}`, snapshot);

        // 1. Luôn restore comment nền nếu có index
        if (snapshot.commentIndex !== undefined && snapshot.commentIndex !== -1) {
            // Đảm bảo dữ liệu comment đã được quét
            if (PopupState.getComments().length === 0) {
                CommentController.scanComments(); 
            }
            
            // Activate Comment (UI)
            CommentController.activate(snapshot.commentIndex);
            
            // Scroll trang chính
            const comments = PopupState.getComments();
            if (comments[snapshot.commentIndex]) {
                const item = comments[snapshot.commentIndex];
                if (item && item.id) Scroller.scrollToId(item.id, 'instant');
            }
        }

        // 2. Nếu type là Quicklook, restore đè lên
        if (snapshot.type === 'quicklook' && snapshot.quicklookUrl) {
            QuicklookController.handleLinkRequest(snapshot.quicklookUrl, true);
        }
    }
};