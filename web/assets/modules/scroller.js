// Path: web/assets/modules/scroller.js
import { getLogger } from './logger.js';

const logger = getLogger("Scroller");

// [CONFIG] Chiều cao Header + Padding mong muốn (Pixel)
// Tăng lên nếu header của bạn cao, để tránh chữ bị che
const SCROLL_OFFSET = 80; 

function getTargetPosition(element) {
    // Vị trí hiện tại của scroll
    const currentScrollY = window.scrollY || window.pageYOffset;
    // Vị trí của phần tử so với viewport hiện tại
    const rectTop = element.getBoundingClientRect().top;
    
    // Tính toán đích đến tuyệt đối
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

export const Scroller = {
    /**
     * Cuộn ngay lập tức (dùng cho Initial Load)
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
                
                // Highlight
                document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                element.classList.add('highlight');
            } else if (retries > 0) {
                setTimeout(() => attemptFind(retries - 1), 50);
            }
        };
        attemptFind(10);
    },

    /**
     * [NEW] Chuyển cảnh mượt mà: Fade Out -> Render -> Jump -> Fade In
     * @param {Function} renderAction - Hàm thực hiện việc render HTML (VD: loadSutta)
     * @param {string} targetId - ID cần cuộn tới sau khi render
     */
    transitionTo: async function(renderAction, targetId) {
        const container = document.getElementById("sutta-container");
        if (!container) {
            if (renderAction) renderAction();
            return;
        }

        logger.debug(`Starting transition to #${targetId || 'top'}`);

        // 1. FADE OUT (Nội dung cũ)
        container.classList.add('nav-transitioning');
        container.classList.add('exit-up'); // Mặc định bay lên

        // Đợi animation CSS (150ms)
        await new Promise(r => setTimeout(r, 150));

        // 2. RENDER (Thay ruột)
        if (renderAction) renderAction();

        // 3. JUMP & PREPARE ENTER
        // Reset scroll về đầu hoặc vị trí đích
        if (targetId) {
            // Cần chờ 1 tick để DOM mới được paint
            await new Promise(r => requestAnimationFrame(r));
            
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                window.scrollTo(0, targetY);
                
                // Highlight mới
                document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                element.classList.add('highlight');
            } else {
                window.scrollTo(0, 0);
            }
        } else {
            window.scrollTo(0, 0);
        }

        // Chuẩn bị trạng thái Fade In (từ dưới lên)
        container.classList.remove('exit-up');
        container.classList.add('enter-from-bottom');

        // 4. FADE IN (Nội dung mới)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.classList.remove('enter-from-bottom');
                
                // Cleanup class sau khi xong
                setTimeout(() => {
                    container.classList.remove('nav-transitioning');
                }, 150);
            });
        });
    }
};