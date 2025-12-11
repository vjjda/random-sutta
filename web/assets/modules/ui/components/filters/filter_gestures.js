// Path: web/assets/modules/ui/components/filters/filter_gestures.js

let isDragging = false;
let dragTargetState = true;

export const FilterGestures = {
    initGlobalHandlers(onDragMove, onDragEnd) {
        if (window._filterGesturesInit) return;
        window._filterGesturesInit = true;

        const endDrag = () => {
            if (isDragging) {
                isDragging = false;
                onDragEnd(); // Commit changes (Update URL)
            }
        };
        window.addEventListener("mouseup", endDrag);
        window.addEventListener("touchend", endDrag);

        window.addEventListener("touchmove", (e) => {
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
        let lastTapTime = 0; // Scoped variable for Double Tap detection

        const handleStart = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            
            const now = Date.now();
            const timeDiff = now - lastTapTime;
            
            // [UPDATED] Tinh chỉnh độ nhạy
            // 1. Giảm xuống 250ms: Để tránh nhầm lẫn khi người dùng toggle nhanh (tắt/bật liên tục)
            // 2. Thêm > 50ms: Để lọc bỏ các cú chạm bị rung tay (micro-touches) trên màn hình cảm ứng
            if (timeDiff < 250 && timeDiff > 50) {
                onSolo(bookId);
                isDragging = false; // Prevent dragging conflict
                lastTapTime = 0;    // Reset
                return;
            }
            
            lastTapTime = now;

            // Single Tap / Drag Start Logic
            isDragging = true;
            const currentActive = currentStateFn(bookId);
            dragTargetState = !currentActive; 
            
            onToggle(bookId, dragTargetState); 
        };

        const onEnter = (e) => {
            if (isDragging) {
                onToggle(bookId, dragTargetState);
            }
        };

        btn.addEventListener("mousedown", handleStart);
        btn.addEventListener("touchstart", handleStart, { passive: true });
        btn.addEventListener("mouseenter", onEnter);
        
        btn.addEventListener("click", (e) => e.preventDefault());
        
        btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }
};