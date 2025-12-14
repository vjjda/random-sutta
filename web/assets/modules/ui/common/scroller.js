// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("Scroller");
const SCROLL_OFFSET = 0;

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    return currentScrollY + rectTop - SCROLL_OFFSET;
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

    // [UPDATED] Thêm tham số behavior (mặc định 'smooth')
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

    // [UPDATED] Nhận tham số behavior và truyền vào window.scrollTo
    _findAndScroll(targetId, positionCalculator, behavior) {
        let retries = 0;
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = positionCalculator(element);
                window.scrollTo({ top: targetY, behavior: behavior });
            } else {
                retries++;
                if (retries < maxRetries) {
                    requestAnimationFrame(attemptFind);
                }
            }
        };
        requestAnimationFrame(attemptFind);
    },

    // Legacy wrappers
    animateScrollTo: function(targetId) {
        this.scrollToId(targetId, 'smooth');
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        await new Promise(r => requestAnimationFrame(r));
        if (targetId) {
            this.scrollToId(targetId, 'smooth');
        } else {
            this.restoreScrollTop(0);
        }
    }
};