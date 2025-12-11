// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Scroller");
const SCROLL_OFFSET = 0;

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

function clearHighlights() {
    document.querySelectorAll('.highlight, .highlight-container').forEach(el => {
        el.classList.remove('highlight');
        el.classList.remove('highlight-container');
    });
}

// Logic chọn style highlight: Segment (Nền) vs Container (Viền)
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
            // [SNAPPY] behavior: 'instant' force trình duyệt nhảy ngay lập tức
            window.scrollTo({ 
                top: y, 
                behavior: 'instant' 
            });
        }, 0);
    },

    scrollToId: function(targetId) {
        if (!targetId) {
            this.restoreScrollTop(0);
            return;
        }

        let retries = 0;
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                
                // [SNAPPY] Jump instantly
                window.scrollTo({ top: targetY, behavior: 'instant' });
                
                applyHighlight(element);
                
                // Double check layout shift (vẫn cần thiết để đảm bảo chính xác, nhưng nhảy ngay)
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
        // Tên hàm giữ nguyên để tương thích interface, nhưng hành vi là instant
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