// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Scroller");
const SCROLL_OFFSET = 0;

// ... (Giữ nguyên các hàm helper getTargetPosition, clearHighlights, applyHighlight) ...
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
    // [NEW] 1. Lấy vị trí cuộn hiện tại (Wrapper an toàn)
    getScrollTop: function() {
        return window.scrollY || document.documentElement.scrollTop || 0;
    },

    // [NEW] 2. Khôi phục vị trí cuộn (Đóng gói logic Timeout/Instant)
    restoreScrollTop: function(y) {
        if (typeof y !== 'number') return;
        
        // Dùng setTimeout để đẩy xuống cuối Event Loop, 
        // đảm bảo Stack Render của trình duyệt đã tính toán xong chiều cao DOM
        setTimeout(() => {
            window.scrollTo({ 
                top: y, 
                behavior: 'instant' // Quan trọng: Không dùng smooth khi restore history
            });
        }, 0);
    },

    scrollToId: function(targetId) {
        if (!targetId) {
            this.restoreScrollTop(0); // Dùng lại hàm restore cho nhất quán
            return;
        }

        let retries = 0;
        const maxRetries = 60;
        const attemptFind = () => {
            // [FIX] Escape ký tự đặc biệt trong ID (như dấu hai chấm mn10:36.4)
            // Tuy nhiên getElementById xử lý tốt việc này, chỉ querySelector mới cần escape.
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                window.scrollTo({ top: targetY, behavior: 'instant' });
                applyHighlight(element);
                
                // Double check layout shift
                setTimeout(() => {
                     const newY = getTargetPosition(element);
                     if (Math.abs(newY - window.scrollY) > 2) {
                         window.scrollTo({ top: newY, behavior: 'instant' });
                     }
                }, 50);
            } else {
                retries++;
                if (retries < maxRetries) {
                    requestAnimationFrame(attemptFind);
                } else {
                    logger.warn('scrollToId', `Element not found: ${targetId}`);
                }
            }
        };
        requestAnimationFrame(attemptFind);
    },

    animateScrollTo: function(targetId) {
        this.scrollToId(targetId);
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        await new Promise(r => requestAnimationFrame(r));
        if (targetId) {
            this.scrollToId(targetId);
        } else {
            this.restoreScrollTop(0);
        }
    }
};