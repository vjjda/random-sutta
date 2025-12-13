// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Scroller");
const SCROLL_OFFSET = 0; // Offset cứng cho Header (nếu cần)

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

// [NEW] Tính toán vị trí "Reading Mode" (30% màn hình)
function getReadingPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    
    // Đích đến: Element nằm ở vị trí 30% từ đỉnh màn hình xuống
    // offset = viewportHeight * 0.3
    const offset = viewportHeight * 0.3;
    
    return currentScrollY + rectTop - offset;
}

function clearHighlights() {
    document.querySelectorAll('.highlight, .highlight-container, .tts-active').forEach(el => {
        el.classList.remove('highlight');
        el.classList.remove('highlight-container');
        // Không xóa tts-active ở đây vì TTSManager quản lý riêng
    });
}

function applyHighlight(element) {
    if (!element) return;
    clearHighlights();
    if (element.classList.contains('segment')) {
        element.classList.add('highlight');
    } else {
        element.classList.add('highlight-container');
    }
}

export const Scroller = {
    getScrollTop: function() {
        return window.scrollY || document.documentElement.scrollTop || 0;
    },

    restoreScrollTop: function(y) {
        if (typeof y !== 'number') return;
        setTimeout(() => {
            window.scrollTo({ top: y, behavior: 'instant' });
        }, 0);
    },

    scrollToId: function(targetId) {
        if (!targetId) {
            this.restoreScrollTop(0);
            return;
        }
        this._findAndScroll(targetId, getTargetPosition);
    },

    // [NEW] Hàm cuộn dành riêng cho TTS
    scrollToReadingPosition: function(targetId) {
        if (!targetId) return;
        this._findAndScroll(targetId, getReadingPosition);
    },

    // Helper nội bộ để tránh lặp code retry
    _findAndScroll(targetId, positionCalculator) {
        let retries = 0;
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = positionCalculator(element);
                
                // Behavior 'smooth' để mắt người dùng dễ theo dõi luồng đọc
                // Nhưng nếu khoảng cách quá xa (ví dụ nhảy trang), có thể dùng 'instant'
                window.scrollTo({ top: targetY, behavior: 'smooth' });
                
                // TTS Highlight được xử lý bởi TTSManager, ở đây chỉ xử lý scroll
            } else {
                retries++;
                if (retries < maxRetries) {
                    requestAnimationFrame(attemptFind);
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