// Path: web/assets/modules/scroller.js
import { getLogger } from './logger.js';

const logger = getLogger("Scroller");

// [FIX] Đưa về 0 để không còn khoảng trống thừa phía trên
const SCROLL_OFFSET = 0; 

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

export const Scroller = {
    /**
     * Cuộn ngay lập tức (Dùng cho Initial Load)
     */
    scrollToId: function(targetId) {
        if (!targetId) {
            window.scrollTo(0, 0);
            return;
        }

        const attemptFind = (retries) => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                logger.debug(`Direct scroll to #${targetId}: ${targetY}`);
                window.scrollTo(0, targetY);
                
                // [FIX] Đã xóa logic add('highlight')
            } else if (retries > 0) {
                setTimeout(() => attemptFind(retries - 1), 50);
            }
        };
        attemptFind(10);
    },

    /**
     * [NEW] Cuộn có hiệu ứng Fade trong cùng 1 trang (Dùng cho TOH)
     */
    animateScrollTo: async function(targetId) {
        const container = document.getElementById("sutta-container");
        const element = document.getElementById(targetId);
        
        if (!container || !element) return;

        logger.debug(`Animating scroll to #${targetId}`);

        // 1. Fade Out
        container.classList.add('nav-transitioning');
        container.classList.add('exit-up'); // Bay lên nhẹ

        await new Promise(r => setTimeout(r, 150));

        // 2. Jump
        const targetY = getTargetPosition(element);
        window.scrollTo(0, targetY);

        // 3. Prepare Fade In
        container.classList.remove('exit-up');
        container.classList.add('enter-from-bottom'); // Từ dưới lên nhẹ

        // 4. Fade In
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.classList.remove('enter-from-bottom');
                setTimeout(() => {
                    container.classList.remove('nav-transitioning');
                }, 150);
            });
        });
    },

    /**
     * Chuyển cảnh khi load Sutta mới (Popup, Link, Next/Prev)
     */
    transitionTo: async function(renderAction, targetId) {
        const container = document.getElementById("sutta-container");
        if (!container) {
            if (renderAction) renderAction();
            return;
        }

        logger.debug(`Transitioning to #${targetId || 'top'}`);

        // 1. FADE OUT
        container.classList.add('nav-transitioning');
        container.classList.add('exit-up');

        await new Promise(r => setTimeout(r, 150));

        // 2. RENDER
        if (renderAction) renderAction();

        // 3. JUMP
        // Chờ 1 tick để DOM render xong
        await new Promise(r => requestAnimationFrame(r));
        
        if (targetId) {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                window.scrollTo(0, targetY);
                // [FIX] Đã xóa logic highlight
            } else {
                window.scrollTo(0, 0);
            }
        } else {
            window.scrollTo(0, 0);
        }

        // 4. FADE IN
        container.classList.remove('exit-up');
        container.classList.add('enter-from-bottom');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.classList.remove('enter-from-bottom');
                setTimeout(() => {
                    container.classList.remove('nav-transitioning');
                }, 150);
            });
        });
    }
};