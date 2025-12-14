// Path: web/assets/modules/ui/components/popup/controllers/comment_controller.js
import { PopupState } from '../state/popup_state.js';
import { PopupScanner } from '../utils/popup_scanner.js';
import { CommentUI } from '../ui/comment_ui.js';
import { QuicklookUI } from '../ui/quicklook_ui.js';
import { Scroller } from 'ui/common/scroller.js';

export const CommentController = {
    init() {
        CommentUI.init({
            onClose: () => this.close(),
            onNavigate: (dir) => this.navigate(dir),
            onLinkClick: (href) => {
                window.dispatchEvent(new CustomEvent('popup:request-link', { detail: { href } }));
            }
        });
    },

    scanComments() {
        const list = PopupScanner.scan("sutta-container");
        PopupState.setComments(list);
    },

    openByText(text) {
        const comments = PopupState.getComments();
        if (comments.length === 0) this.scanComments();
        
        const index = PopupState.getComments().findIndex(c => c.text === text);
        if (index !== -1) {
            this.activate(index);
            QuicklookUI.hide();
        }
    },

    activate(index) {
        PopupState.setCommentActive(index);
        
        const comments = PopupState.getComments();
        const total = comments.length;
        
        if (index >= 0 && index < total) {
            const item = comments[index];
            const context = PopupScanner.getContextText(comments, index);
            CommentUI.render(item.text, index, total, context);
        }
    },

    navigate(dir) {
        let currentIdx = PopupState.activeIndex;
        const comments = PopupState.getComments();
        
        const nextIdx = currentIdx + dir;
        if (nextIdx >= 0 && nextIdx < comments.length) {
            this.activate(nextIdx);
            
            // [FIXED] Instant Jump & Highlight Sync
            const item = comments[nextIdx];
            if (item && item.id) {
                Scroller.jumpTo(item.id);
                Scroller.highlightElement(item.id); // <--- Thêm dòng này
            }
            
            QuicklookUI.hide();
        }
    },

    close() {
        CommentUI.hide();
        window.dispatchEvent(new CustomEvent('popup:close-all'));
    }
};