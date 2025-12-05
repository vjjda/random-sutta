// Path: web/assets/modules/scroller.js
import { getLogger } from './logger.js';

const logger = getLogger("Scroller");

const SCROLL_OFFSET = 0;

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
    /**
     * Cuộn ngay lập tức đến ID mục tiêu
     */
    scrollToId: function(targetId) {
        if (!targetId) {
            window.scrollTo({ top: 0, behavior: 'instant' });
            return;
        }

        const attemptFind = (retries) => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                // [FIX] Thêm behavior: 'instant' để ghi đè smooth scroll của CSS
                window.scrollTo({ top: targetY, behavior: 'instant' });
                applyHighlight(element);
            } else if (retries > 0) {
                setTimeout(() => attemptFind(retries - 1), 20);
            }
        };
        attemptFind(5);
    },

    animateScrollTo: function(targetId) {
        this.scrollToId(targetId);
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) renderAction();
        await new Promise(r => setTimeout(r, 0));

        if (targetId) {
            this.scrollToId(targetId);
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
};