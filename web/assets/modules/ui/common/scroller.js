// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Scroller");
const SCROLL_OFFSET = 0; // Có thể chỉnh nếu có Header fixed

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

function clearHighlights() {
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
}

function applyHighlight(element) {
    if (!element) return;
    clearHighlights();
    element.classList.add('highlight');
}

export const Scroller = {
    /**
     * Cuộn ngay lập tức đến ID mục tiêu với cơ chế Retry.
     * Hữu ích khi nội dung được render bất đồng bộ hoặc layout shift.
     */
    scrollToId: function(targetId) {
        if (!targetId) {
            window.scrollTo({ top: 0, behavior: 'instant' });
            return;
        }

        let retries = 0;
        // Thử tìm element trong khoảng 1 giây (60 frames)
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                // Tìm thấy -> Cuộn & Highlight
                const targetY = getTargetPosition(element);
                window.scrollTo({ top: targetY, behavior: 'instant' });
                applyHighlight(element);
                
                // [SAFETY] Double-check vị trí sau 50ms (phòng trường hợp ảnh load làm đẩy layout)
                setTimeout(() => {
                     const newY = getTargetPosition(element);
                     if (Math.abs(newY - window.scrollY) > 2) {
                        window.scrollTo({ top: newY, behavior: 'instant' });
                     }
                }, 50);
            } else {
                // Chưa thấy -> Thử lại
                retries++;
                if (retries < maxRetries) {
                    requestAnimationFrame(attemptFind);
                } else {
                    logger.warn('scrollToId', `Could not scroll. Element not found: ${targetId}`);
                }
            }
        };

        requestAnimationFrame(attemptFind);
    },

    animateScrollTo: function(targetId) {
        // Hiện tại dùng chung logic với scrollToId (instant nhưng có highlight effect CSS)
        // Có thể mở rộng thành smooth scroll native nếu cần
        this.scrollToId(targetId);
    },

    /**
     * Helper cho việc chuyển trang: Render xong mới cuộn.
     */
    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        // Chờ 1 frame để browser paint DOM
        await new Promise(r => requestAnimationFrame(r));
        
        if (targetId) {
            this.scrollToId(targetId);
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
};