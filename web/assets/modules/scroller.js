// Path: web/assets/modules/scroller.js
import { getLogger } from './logger.js';

const logger = getLogger("Scroller");

// [FIX] Đưa về 0 để sát mép trên
const SCROLL_OFFSET = 0; 

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

export const Scroller = {
    /**
     * Cuộn ngay lập tức (Initial Load / Direct Link)
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
                window.scrollTo(0, targetY);
                // [FIX] Đã xóa logic add class 'highlight'
            } else if (retries > 0) {
                setTimeout(() => attemptFind(retries - 1), 50);
            }
        };
        // Thử tìm trong 500ms (10 lần x 50ms) đề phòng DOM render chậm
        attemptFind(10);
    },

    /**
     * [NEW] Hiệu ứng Fade -> Jump -> Fade (Dùng cho TOH)
     */
    animateScrollTo: async function(targetId) {
        const container = document.getElementById("sutta-container");
        const element = document.getElementById(targetId);
        
        if (!container || !element) return;

        // 1. Fade Out
        container.classList.add('nav-transitioning');
        container.classList.add('exit-up');

        await new Promise(r => setTimeout(r, 150));

        // 2. Jump
        const targetY = getTargetPosition(element);
        window.scrollTo(0, targetY);

        // 3. Prepare Fade In
        container.classList.remove('exit-up');
        container.classList.add('enter-from-bottom');

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
     * Chuyển cảnh khi load Sutta mới (Popup, Link)
     */
    transitionTo: async function(renderAction, targetId) {
        const container = document.getElementById("sutta-container");
        if (!container) {
            if (renderAction) renderAction();
            return;
        }

        // 1. FADE OUT
        container.classList.add('nav-transitioning');
        container.classList.add('exit-up');

        await new Promise(r => setTimeout(r, 150));

        // 2. RENDER
        if (renderAction) renderAction();

        // 3. JUMP
        // [IMPORTANT FIX] Đợi lâu hơn 1 chút để Browser tính toán lại Layout (Reflow)
        // 50ms là đủ để render engine cập nhật vị trí các phần tử mới
        await new Promise(r => setTimeout(r, 50));
        
        if (targetId) {
            // Thử tìm phần tử (logic retry nhẹ)
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                window.scrollTo(0, targetY);
            } else {
                // Fallback nếu không tìm thấy ID (ví dụ ID sai)
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