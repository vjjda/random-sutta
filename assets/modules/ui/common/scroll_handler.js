// Path: web/assets/modules/ui/common/scroll_handler.js

/**
 * Utility to handle scroll locking within popups for Mouse/Trackpad (Wheel events).
 * Prevents "Scroll Chaining" where scrolling propagates to the background body.
 */
export class ScrollHandler {
    /**
     * Attaches a wheel listener to the container to manage scroll boundaries.
     * @param {HTMLElement} container - The main popup container (e.g., #comment-popup).
     * @param {HTMLElement} scrollableContent - The internal scrollable element (e.g., .popup-body).
     */
    static preventBackgroundScroll(container, scrollableContent) {
        if (!container) return;

        container.addEventListener('wheel', (e) => {
            // 1. Check if the event target is inside the main scrollable content
            if (scrollableContent && scrollableContent.contains(e.target)) {
                const { scrollTop, scrollHeight, clientHeight } = scrollableContent;
                const delta = e.deltaY;
                const isScrollable = scrollHeight > clientHeight;

                // Case A: Content is short and not scrollable at all.
                // Always block to prevent background scroll.
                if (!isScrollable) {
                    if (e.cancelable) e.preventDefault();
                    return;
                }

                // Case B: Content is scrollable. Check boundaries.
                // - Scrolling UP (delta < 0) when at TOP
                // - Scrolling DOWN (delta > 0) when at BOTTOM
                // Use a small tolerance (1px) for cross-browser float precision.
                const atTop = scrollTop <= 0;
                const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

                if ((atTop && delta < 0) || (atBottom && delta > 0)) {
                    if (e.cancelable) e.preventDefault();
                }
                
                // If neither boundary is hit, allow native scrolling of the div.
                return;
            }

            // 2. Check if the user is scrolling on another scrollable element within the popup
            // (e.g., a horizontally scrolling header).
            let target = e.target;
            let isOtherScrollable = false;

            while (target && target !== container) {
                // Check if this specific element has scrollable overflow
                if (target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth) {
                    const style = window.getComputedStyle(target);
                    const overflowY = style.overflowY;
                    const overflowX = style.overflowX;
                    
                    if (['auto', 'scroll'].includes(overflowY) || ['auto', 'scroll'].includes(overflowX)) {
                        isOtherScrollable = true;
                        break; 
                    }
                }
                target = target.parentElement;
            }

            // If we are NOT in the main body AND NOT in another scrollable area
            // (e.g., scrolling on a static header or footer), block it.
            if (!isOtherScrollable) {
                if (e.cancelable) e.preventDefault();
            }

        }, { passive: false });
    }
}
