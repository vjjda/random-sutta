// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("Scroller");

// [CONFIG] Khoảng cách đệm bên trên khi cuộn tới ID (để tạo context)
const SCROLL_OFFSET_CTX = 60; // Pixels

function getTargetPosition(element) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const rectTop = element.getBoundingClientRect().top;
    // Trừ đi offset để element nằm thấp hơn mép trên một chút
    return currentScrollY + rectTop - SCROLL_OFFSET_CTX;
}

// Giữ nguyên logic tính vị trí cho TTS Reading
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
        // Restore luôn dùng instant
        setTimeout(() => {
            window.scrollTo({ top: y, behavior: 'instant' });
        }, 0);
    },

    // [UPDATED] Hàm Scroll chính: Mặc định là smooth, nhưng cho phép override thành instant
    scrollToId: function(targetId, behavior = 'smooth') {
        if (!targetId) {
            this.restoreScrollTop(0);
            return;
        }
        // Luôn dùng _findAndScroll để tính toán vị trí chính xác (có offset)
        this._findAndScroll(targetId, getTargetPosition, behavior);
    },

    scrollToReadingPosition: function(targetId, behavior = 'smooth') {
        if (!targetId) return;
        this._findAndScroll(targetId, getReadingPosition, behavior);
    },

    _findAndScroll(targetId, positionCalculator, behavior) {
        let retries = 0;
        const maxRetries = 60;

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = positionCalculator(element);
                // Thực hiện cuộn với behavior được chỉ định
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

    // Hàm legacy dùng cho các click bình thường (vẫn smooth)
    animateScrollTo: function(targetId) {
        this.scrollToId(targetId, 'smooth');
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        // Chờ 1 frame để DOM render xong
        await new Promise(r => requestAnimationFrame(r));
        
        if (targetId) {
            // Khi chuyển trang (Transition), dùng smooth cho mượt
            this.scrollToId(targetId, 'smooth');
        } else {
            this.restoreScrollTop(0);
        }
    }
};