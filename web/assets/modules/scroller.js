// Path: web/assets/modules/scroller.js
import { getLogger } from './logger.js';

const logger = getLogger("Scroller");

const SCROLL_OFFSET = 0;

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
    // Vẫn giữ highlight màu nền để người dùng biết đang ở đâu
    element.classList.add('highlight');
}

export const Scroller = {
    /**
     * Cuộn ngay lập tức đến ID mục tiêu
     */
    scrollToId: function(targetId) {
        if (!targetId) {
            window.scrollTo(0, 0);
            return;
        }

        // Thử tìm element, nếu chưa render kịp thì retry nhẹ (20ms) để đảm bảo DOM đã có
        const attemptFind = (retries) => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                window.scrollTo(0, targetY);
                applyHighlight(element);
            } else if (retries > 0) {
                setTimeout(() => attemptFind(retries - 1), 20);
            }
        };
        attemptFind(5);
    },

    /**
     * [MODIFIED] Alias sang scrollToId để tắt animation
     * Giữ tên hàm để tương thích với các module khác (ToH)
     */
    animateScrollTo: function(targetId) {
        this.scrollToId(targetId);
    },

    /**
     * [MODIFIED] Loại bỏ hiệu ứng Fade Out/In khi chuyển trang.
     * Logic: Render -> Chờ DOM update -> Jump.
     */
    transitionTo: async function(renderAction, targetId) {
        // 1. Render ngay lập tức
        if (renderAction) renderAction();

        // 2. Chờ 1 tick để browser layout lại DOM mới
        await new Promise(r => setTimeout(r, 0));

        // 3. Jump đến vị trí mong muốn
        if (targetId) {
            this.scrollToId(targetId);
        } else {
            window.scrollTo(0, 0);
        }
    }
};