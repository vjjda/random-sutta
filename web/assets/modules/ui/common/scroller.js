// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from '../../utils/logger.js';
import { AppConfig } from '../../core/app_config.js'; // [NEW] Import config

const logger = getLogger("Scroller");
const SCROLL_OFFSET = 0; 

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
}

// [UPDATED] Tính toán vị trí dựa trên AppConfig
function getReadingPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    
    // Lấy config (mặc định 30vh nếu lỗi)
    const configVal = AppConfig.TTS?.SCROLL_OFFSET_TOP || '30vh';
    let offsetPx = 0;

    // Parse Config: Hỗ trợ 'vh' hoặc 'px'
    if (configVal.endsWith('vh')) {
        const percent = parseFloat(configVal) / 100;
        offsetPx = viewportHeight * percent;
    } else if (configVal.endsWith('px')) {
        offsetPx = parseFloat(configVal);
    } else {
        // Fallback đơn giản nếu chỉ nhập số
        offsetPx = parseFloat(configVal); 
    }

    return currentScrollY + rectTop - offsetPx;
}

function clearHighlights() {
    document.querySelectorAll('.highlight, .highlight-container, .tts-active').forEach(el => {
        el.classList.remove('highlight');
        el.classList.remove('highlight-container');
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

    scrollToReadingPosition: function(targetId) {
        if (!targetId) return;
        this._findAndScroll(targetId, getReadingPosition);
    },

    _findAndScroll(targetId, positionCalculator) {
        let retries = 0;
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = positionCalculator(element);
                window.scrollTo({ top: targetY, behavior: 'smooth' });
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