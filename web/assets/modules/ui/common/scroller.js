// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("Scroller");

// Offset context khi jump đến
const SCROLL_OFFSET_CTX = 60; 

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET_CTX;
}

function getReadingPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    
    const configVal = AppConfig.TTS?.SCROLL_OFFSET_TOP || '30vh';
    let offsetPx = 0;

    if (configVal.endsWith('vh')) {
        const percent = parseFloat(configVal) / 100;
        offsetPx = viewportHeight * percent;
    } else if (configVal.endsWith('px')) {
        offsetPx = parseFloat(configVal);
    } else {
        offsetPx = parseFloat(configVal);
    }

    return currentScrollY + rectTop - offsetPx;
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

    scrollToId: function(targetId, behavior = 'smooth') {
        if (!targetId) {
            this.restoreScrollTop(0);
            return;
        }
        this._findAndScroll(targetId, getTargetPosition, behavior);
    },

    scrollToReadingPosition: function(targetId, behavior = 'smooth') {
        if (!targetId) return;
        this._findAndScroll(targetId, getReadingPosition, behavior);
    },

    // [NEW] Hàm chuyên dụng để Highlight phần tử sau khi jump
    highlightElement: function(targetId) {
        // 1. Xóa highlight cũ
        document.querySelectorAll('.highlight, .highlight-container').forEach(el => {
            el.classList.remove('highlight', 'highlight-container');
        });

        if (!targetId) return;

        // 2. Tìm và highlight mới
        const el = document.getElementById(targetId);
        if (el) {
            // Nếu là segment (câu) -> highlight nền vàng
            if (el.classList.contains('segment')) {
                el.classList.add('highlight');
            } 
            // Nếu là heading/block -> highlight đường viền trái
            else {
                el.classList.add('highlight-container');
            }
        }
    },

    _findAndScroll(targetId, positionCalculator, behavior) {
        let retries = 0;
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = positionCalculator(element);
                
                // [FIXED] Force Instant: Tắt CSS smooth scroll tạm thời nếu cần instant
                if (behavior === 'instant') {
                    document.documentElement.style.scrollBehavior = 'auto';
                }

                window.scrollTo({ top: targetY, behavior: behavior });

                // Restore CSS behavior
                if (behavior === 'instant') {
                    setTimeout(() => {
                        document.documentElement.style.scrollBehavior = '';
                    }, 50);
                }
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
        this.scrollToId(targetId, 'smooth');
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        await new Promise(r => requestAnimationFrame(r));
        if (targetId) {
            this.scrollToId(targetId, 'smooth');
            // [NEW] Highlight khi transition xong (cho trường hợp click link nội bộ)
            this.highlightElement(targetId); 
        } else {
            this.restoreScrollTop(0);
        }
    }
};