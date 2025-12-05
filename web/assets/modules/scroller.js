// Path: web/assets/modules/scroller.js
import { getLogger } from './logger.js';

const logger = getLogger("Scroller");

// Cấu hình khoảng cách từ mép trên (để tránh bị header che hoặc quá sát)
const SCROLL_OFFSET = 60; // Pixel (Tùy chỉnh theo chiều cao Header của bạn)

/**
 * Hiệu ứng chuyển cảnh và cuộn đến phần tử đích.
 * @param {HTMLElement} element - Phần tử cần cuộn đến.
 */
function performFadeJump(element) {
    const container = document.getElementById("sutta-container");
    if (!container || !element) return;

    // 1. Tính toán vị trí đích chính xác
    const startY = window.scrollY || window.pageYOffset;
    const rect = element.getBoundingClientRect();
    // Vị trí tuyệt đối = Vị trí hiện tại + Vị trí tương đối của element - Offset mong muốn
    const targetY = startY + rect.top - SCROLL_OFFSET;

    // 2. Xác định hướng (để chọn Animation)
    const isGoingDown = targetY > startY;
    
    logger.debug(`Jumping to ${element.id} (From: ${Math.round(startY)} -> To: ${Math.round(targetY)})`);

    // 3. Setup Class Animation
    const exitClass = isGoingDown ? 'exit-up' : 'exit-down';
    const entryClass = isGoingDown ? 'enter-from-bottom' : 'enter-from-top';

    // --- PHASE 1: FADE OUT ---
    container.classList.add('nav-transitioning');
    void container.offsetWidth; // Force Reflow
    container.classList.add(exitClass);

    // --- PHASE 2: TELEPORT & PREPARE ENTRY ---
    setTimeout(() => {
        // Nhảy đến đích (Native Scroll - Tức thì)
        window.scrollTo(0, targetY);

        // Reset trạng thái để chuẩn bị Fade In
        container.classList.remove('nav-transitioning');
        container.classList.remove(exitClass);
        
        // Đặt vị trí bắt đầu cho entry
        container.classList.add(entryClass);

        // --- PHASE 3: FADE IN ---
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.classList.add('nav-transitioning');
                // Gỡ class entry -> Element trượt về vị trí gốc (opacity 1, transform 0)
                container.classList.remove(entryClass);
                
                // Highlight phần tử đích
                document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                element.classList.add('highlight');

                // Cleanup
                setTimeout(() => {
                    container.classList.remove('nav-transitioning');
                }, 150);
            });
        });
    }, 150); // Thời gian khớp với CSS transition
}

export const Scroller = {
    /**
     * Hàm duy nhất để gọi scroll trong toàn bộ App.
     * @param {string} targetId - ID của phần tử (không có dấu #)
     */
    scrollToId: function(targetId) {
        if (!targetId) {
            window.scrollTo(0, 0);
            return;
        }

        // Thử tìm phần tử (Retry nhẹ nếu DOM chưa render xong)
        const attemptFind = (retries) => {
            const element = document.getElementById(targetId);
            if (element) {
                performFadeJump(element);
            } else if (retries > 0) {
                logger.debug(`Element #${targetId} not found, retrying... (${retries})`);
                setTimeout(() => attemptFind(retries - 1), 50);
            } else {
                logger.warn(`Failed to scroll: Element #${targetId} not found.`);
            }
        };

        attemptFind(5); // Thử 5 lần, mỗi lần cách nhau 50ms
    }
};