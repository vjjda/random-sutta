// Path: web/assets/modules/ui/components/filters/filter_gestures.js

let isDragging = false;
let dragTargetState = true; 
let longPressTimer = null;

export const FilterGestures = {
    // Đăng ký các sự kiện Global (Window)
    initGlobalHandlers(onDragMove, onDragEnd) {
        if (window._filterGesturesInit) return;
        window._filterGesturesInit = true;

        const endDrag = () => {
            clearTimeout(longPressTimer);
            if (isDragging) {
                isDragging = false;
                onDragEnd(); // Callback cập nhật URL
            }
        };

        window.addEventListener("mouseup", endDrag);
        window.addEventListener("touchend", endDrag);

        window.addEventListener("touchmove", (e) => {
            // Di chuyển thì hủy Long Press
            if (longPressTimer) clearTimeout(longPressTimer);

            if (!isDragging) return;

            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);

            if (target && target.classList.contains("filter-btn")) {
                const bId = target.dataset.bookId;
                if (bId) {
                    // Callback xử lý logic toggle (nhưng không update URL)
                    onDragMove(bId, dragTargetState);
                }
            }
        }, { passive: true });
    },

    // Gắn sự kiện cho từng nút
    attachToButton(btn, bookId, currentStateFn, onToggle, onSolo) {
        
        const startDrag = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;

            isDragging = true;
            
            // 1. Setup Long Press (Solo Mode)
            longPressTimer = setTimeout(() => {
                onSolo(bookId);
                isDragging = false; // Ngắt drag sau khi solo
            }, 800);

            // 2. Setup Drag State (Toggle Mode)
            const currentActive = currentStateFn(bookId);
            dragTargetState = !currentActive; // Mục tiêu là đảo ngược trạng thái hiện tại
            
            // Apply ngay lập tức
            onToggle(bookId, dragTargetState); 
        };

        const onEnter = (e) => {
            if (isDragging) {
                // Drag chuột sang nút khác -> Hủy Long Press cũ
                clearTimeout(longPressTimer);
                onToggle(bookId, dragTargetState);
            }
        };

        btn.addEventListener("mousedown", startDrag);
        btn.addEventListener("touchstart", startDrag, { passive: true });
        btn.addEventListener("mouseenter", onEnter);
        
        // Chặn click mặc định để tránh conflict
        btn.addEventListener("click", (e) => e.preventDefault());
    }
};