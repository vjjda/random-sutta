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
                applyHighlight(element);
            } else if (retries > 0) {
                setTimeout(() => attemptFind(retries - 1), 50);
            }
        };
        attemptFind(10);
    },

    animateScrollTo: async function(targetId) {
        const container = document.getElementById("sutta-container");
        const element = document.getElementById(targetId);
        
        if (!container || !element) return;

        // [FIX GAP] Tính toán vị trí TRƯỚC KHI thêm class animation
        // Lúc này phần tử đang đứng yên, tọa độ sẽ chính xác tuyệt đối
        const targetY = getTargetPosition(element);

        clearHighlights();

        // 1. Fade Out
        container.classList.add('nav-transitioning');
        container.classList.add('exit-up');

        await new Promise(r => setTimeout(r, 150));

        // 2. Jump (Dùng tọa độ đã tính từ trước)
        window.scrollTo(0, targetY);

        // 3. Fade In
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
    },

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
        await new Promise(r => setTimeout(r, 50));
        
        if (targetId) {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = getTargetPosition(element);
                window.scrollTo(0, targetY);
                applyHighlight(element);
            } else {
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