// Path: web/assets/modules/ui/components/filters/filter_gestures.js

let isDragging = false;
let dragTargetState = true; 
let longPressTimer = null;

export const FilterGestures = {
    initGlobalHandlers(onDragMove, onDragEnd) {
        if (window._filterGesturesInit) return;
        window._filterGesturesInit = true;

        const endDrag = () => {
            clearTimeout(longPressTimer);
            if (isDragging) {
                isDragging = false;
                onDragEnd(); // Commit changes (Update URL)
            }
        };

        window.addEventListener("mouseup", endDrag);
        window.addEventListener("touchend", endDrag);

        window.addEventListener("touchmove", (e) => {
            if (longPressTimer) clearTimeout(longPressTimer);

            if (!isDragging) return;

            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);

            if (target && target.classList.contains("filter-btn")) {
                const bId = target.dataset.bookId;
                if (bId) {
                    onDragMove(bId, dragTargetState);
                }
            }
        }, { passive: true });
    },

    attachToButton(btn, bookId, currentStateFn, onToggle, onSolo) {
        
        const startDrag = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;

            isDragging = true;
            
            longPressTimer = setTimeout(() => {
                onSolo(bookId);
                isDragging = false; 
            }, 800);

            const currentActive = currentStateFn(bookId);
            dragTargetState = !currentActive; 
            
            onToggle(bookId, dragTargetState); 
        };

        const onEnter = (e) => {
            if (isDragging) {
                clearTimeout(longPressTimer); 
                onToggle(bookId, dragTargetState);
            }
        };

        btn.addEventListener("mousedown", startDrag);
        btn.addEventListener("touchstart", startDrag, { passive: true });
        btn.addEventListener("mouseenter", onEnter);
        
        btn.addEventListener("click", (e) => e.preventDefault());

        // [NEW] Disable Context Menu (Popup) on Long Press
        btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }
};