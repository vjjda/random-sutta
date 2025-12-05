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
    element.classList.add('highlight');
}

export const Scroller = {
    /**
     * Cuộn ngay lập tức đến ID mục tiêu.
     * Sử dụng cơ chế Retry (thử lại) kiên trì để đảm bảo DOM đã render xong.
     */
    scrollToId: function(targetId) {
        if (!targetId) {
            window.scrollTo({ top: 0, behavior: 'instant' });
            return;
        }

        let retries = 0;
        // Tăng số lần thử lên 60 frames (~1 giây) để an toàn cho cả máy yếu
        const maxRetries = 60; 

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                // Đã tìm thấy element -> Cuộn ngay
                const targetY = getTargetPosition(element);
                window.scrollTo({ top: targetY, behavior: 'instant' });
                applyHighlight(element);
                
                // [SAFETY] Đôi khi layout bị đẩy do hình ảnh/font load chậm
                // Cuộn lại lần nữa sau 50ms để chắc chắn
                setTimeout(() => {
                     const newY = getTargetPosition(element);
                     if (Math.abs(newY - window.scrollY) > 2) {
                        window.scrollTo({ top: newY, behavior: 'instant' });
                     }
                }, 50);

            } else {
                // Chưa thấy -> Thử lại ở frame tiếp theo
                retries++;
                if (retries < maxRetries) {
                    requestAnimationFrame(attemptFind);
                } else {
                    logger.warn(`Could not scroll. Element not found: ${targetId}`);
                }
            }
        };

        // Bắt đầu tìm kiếm ngay
        requestAnimationFrame(attemptFind);
    },

    animateScrollTo: function(targetId) {
        this.scrollToId(targetId);
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) renderAction();

        // Chờ 1 frame để browser nhận diện thay đổi DOM
        await new Promise(r => requestAnimationFrame(r));

        if (targetId) {
            this.scrollToId(targetId);
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
};