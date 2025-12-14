// Path: web/assets/modules/ui/common/scroller.js
import { getLogger } from 'utils/logger.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("Scroller");

// Offset context khi jump đến (trừ hao header)
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
        // Sử dụng setTimeout 0 để đẩy xuống cuối hàng đợi render -> đảm bảo Instant
        setTimeout(() => {
            window.scrollTo({ top: y, behavior: 'instant' });
        }, 0);
    },

    /**
     * [REFACTORED] Instant Jump (Mặc định cho toàn App)
     * Thay thế cho scrollToId cũ.
     */
    jumpTo: function(targetId) {
        if (!targetId) {
            this.restoreScrollTop(0);
            return;
        }
        // Force 'instant' behavior
        this._findAndScroll(targetId, getTargetPosition, 'instant');
    },

    /**
     * Smooth Scroll (Chỉ dùng cho các trường hợp đặc biệt cần animation, vd: Context links)
     */
    smoothScrollTo: function(targetId) {
        if (!targetId) return;
        this._findAndScroll(targetId, getTargetPosition, 'smooth');
    },

    /**
     * Dùng riêng cho TTS (giữ nguyên logic smooth để đọc dễ chịu hơn)
     */
    scrollToReadingPosition: function(targetId) {
        if (!targetId) return;
        this._findAndScroll(targetId, getReadingPosition, 'smooth');
    },

    /**
     * Alias cũ để tương thích ngược (nếu còn sót chỗ nào gọi)
     * Nhưng map sang jumpTo để đảm bảo độ phản hồi nhanh.
     */
    scrollToId: function(targetId, behavior = 'instant') {
        if (behavior === 'smooth') {
            this.smoothScrollTo(targetId);
        } else {
            this.jumpTo(targetId);
        }
    },

    /**
     * Alias cũ cho animation, giờ trỏ về smoothScrollTo
     */
    animateScrollTo: function(targetId) {
        this.smoothScrollTo(targetId);
    },

    highlightElement: function(targetId) {
        // 1. Xóa highlight cũ
        document.querySelectorAll('.highlight, .highlight-container').forEach(el => {
            el.classList.remove('highlight', 'highlight-container');
        });

        if (!targetId) return;

        // 2. Highlight mới
        const el = document.getElementById(targetId);
        if (el) {
            if (el.classList.contains('segment')) {
                el.classList.add('highlight');
            } else {
                el.classList.add('highlight-container');
            }
        }
    },

    transitionTo: async function(renderAction, targetId) {
        if (renderAction) await renderAction();
        
        // Chờ 1 frame để DOM cập nhật
        await new Promise(r => requestAnimationFrame(r));
        
        if (targetId) {
            // Context Links thường dùng transition, nên dùng smooth scroll cho mượt
            this.smoothScrollTo(targetId);
            // Highlight sau khi scroll
            this.highlightElement(targetId);
        } else {
            this.restoreScrollTop(0);
        }
    },

    _findAndScroll(targetId, positionCalculator, behavior) {
        let retries = 0;
        const maxRetries = 60; // Thử trong khoảng 1s (60 frames)

        const attemptFind = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const targetY = positionCalculator(element);

                // [CRITICAL] Override CSS scroll-behavior để đảm bảo Instant tuyệt đối
                if (behavior === 'instant') {
                    document.documentElement.style.scrollBehavior = 'auto';
                }

                window.scrollTo({ top: targetY, behavior: behavior });

                // Restore CSS behavior sau khi jump xong
                if (behavior === 'instant') {
                    // Timeout ngắn để đảm bảo lệnh scroll đã thực thi xong trước khi reset style
                    setTimeout(() => {
                        document.documentElement.style.scrollBehavior = '';
                    }, 50);
                }
            } else {
                retries++;
                if (retries < maxRetries) {
                    requestAnimationFrame(attemptFind);
                } else {
                    logger.warn("Find", `Target not found after retries: ${targetId}`);
                }
            }
        };
        requestAnimationFrame(attemptFind);
    }
};