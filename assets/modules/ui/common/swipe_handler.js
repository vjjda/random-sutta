// Path: web/assets/modules/ui/common/swipe_handler.js

/**
 * Handles swipe gestures with Strict Direction Locking.
 * Prevents vertical scrolling when a horizontal swipe is detected.
 */
export class SwipeHandler {
    /**
     * @param {HTMLElement} element - The target element to listen on.
     * @param {Object} callbacks - { onSwipeLeft: () => void, onSwipeRight: () => void }
     * @param {Object} options - Optional settings
     */
    static attach(element, callbacks, options = {}) {
        if (!element) return;

        const config = {
            minSwipeDistance: options.minSwipeDistance || 60,
            lockThreshold: options.lockThreshold || 10, // Pixels moved before locking direction
            ...options
        };

        let touchStartX = 0;
        let touchStartY = 0;
        let isHorizontalSwipe = false;
        let isVerticalScroll = false;

        // 1. Touch Start
        element.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isHorizontalSwipe = false;
            isVerticalScroll = false;
        }, { passive: false });

        // 2. Touch Move (Lock Direction)
        element.addEventListener('touchmove', (e) => {
            if (isVerticalScroll) return; // Already confirmed vertical -> Do nothing (let browser scroll)

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - touchStartX;
            const diffY = currentY - touchStartY;

            // Decision Phase: Wait until movement exceeds threshold
            if (!isHorizontalSwipe && !isVerticalScroll) {
                if (Math.abs(diffX) > config.lockThreshold || Math.abs(diffY) > config.lockThreshold) {
                    if (Math.abs(diffX) > Math.abs(diffY)) {
                        isHorizontalSwipe = true; // Lock Horizontal
                    } else {
                        isVerticalScroll = true; // Lock Vertical
                    }
                }
            }

            // Action Phase: If Horizontal -> Block Scrolling
            if (isHorizontalSwipe) {
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        // 3. Touch End (Execute Action)
        element.addEventListener('touchend', (e) => {
            if (!isHorizontalSwipe) return;

            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchEndX - touchStartX;
            
            if (Math.abs(diffX) > config.minSwipeDistance) {
                if (diffX > 0) {
                    // Swipe Right
                    if (callbacks.onSwipeRight) callbacks.onSwipeRight();
                } else {
                    // Swipe Left
                    if (callbacks.onSwipeLeft) callbacks.onSwipeLeft();
                }
            }
        });
    }
}