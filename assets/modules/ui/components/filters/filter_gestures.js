// Path: web/assets/modules/ui/components/filters/filter_gestures.js

let isDragging = false;
let dragTargetState = true;
// [NEW] Biến toàn cục để lưu thời điểm chạm cảm ứng cuối cùng
let globalLastTouchTime = 0; 

export const FilterGestures = {
    initGlobalHandlers(onDragMove, onDragEnd) {
        if (window._filterGesturesInit) return;
        window._filterGesturesInit = true;

        const endDrag = () => {
            if (isDragging) {
                isDragging = false;
                onDragEnd(); 
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
        let lastTapTime = 0; 

        const handleStart = (e) => {
            const now = Date.now();

            // [CRITICAL FIX] CHẶN GHOST CLICKS
            // Nếu đây là sự kiện chuột (mousedown) nhưng vừa mới có sự kiện cảm ứng (touchstart)
            // xảy ra trong vòng 800ms trước đó -> Bỏ qua ngay lập tức.
            if (e.type === 'mousedown' && (now - globalLastTouchTime < 800)) {
                return;
            }

            // Nếu đây là sự kiện cảm ứng, cập nhật thời gian chạm toàn cục
            if (e.type === 'touchstart') {
                globalLastTouchTime = now;
            }

            if (e.type === 'mousedown' && e.button !== 0) return;
            
            const timeDiff = now - lastTapTime;
            
            // Logic Double Tap: 
            // - Phải nhỏ hơn 250ms (nhanh)
            // - Phải lớn hơn 50ms (để tránh rung tay/nhiễu phần cứng)
            if (timeDiff < 250 && timeDiff > 50) {
                onSolo(bookId);
                isDragging = false; 
                lastTapTime = 0;    
                return;
            }
            
            lastTapTime = now;

            // Single Tap Logic
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