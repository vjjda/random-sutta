// Path: web/assets/modules/ui/components/popup.js
import { getLogger } from '../../utils/logger.js';
import { Scroller } from '../common/scroller.js'; // Import để sync scroll

const logger = getLogger("PopupManager");

export const PopupManager = {
    elements: {},
    state: {
        comments: [],     // Array of { id, text, element }
        currentIndex: -1,
        touchStartX: 0,
        touchStartY: 0
    },

    init() {
        this.elements = {
            popup: document.getElementById("comment-popup"),
            content: document.getElementById("comment-content"),
            closeBtn: document.getElementById("close-comment"),
            container: document.getElementById("sutta-container"),
            
            // Nav Elements
            btnPrev: document.getElementById("btn-comment-prev"),
            btnNext: document.getElementById("btn-comment-next"),
            infoLabel: document.getElementById("comment-index-info"),
            popupBody: document.querySelector(".popup-body") // For gesture target
        };

        if (!this.elements.popup) {
            logger.warn("init", "Popup elements missing.");
            return;
        }

        this._attachEvents();
    },

    // 1. Quét toàn bộ comment trong bài kinh sau khi render
    scanComments() {
        if (!this.elements.container) return;
        
        const markers = this.elements.container.querySelectorAll(".comment-marker");
        this.state.comments = Array.from(markers).map(marker => {
            // Tìm segment cha để highlight/scroll
            const segment = marker.closest('.segment');
            return {
                id: segment ? segment.id : null,
                text: marker.dataset.comment,
                element: segment
            };
        });
        
        this.state.currentIndex = -1;
        logger.info("scan", `Indexed ${this.state.comments.length} comments.`);
    },

    // 2. Hiển thị Comment
    showComment(text, index = -1) {
        if (!this.elements.content) return;
        
        // Update Content
        this.elements.content.innerHTML = text;
        this.elements.popup.classList.remove("hidden");

        // Sync State (nếu gọi từ click marker)
        if (index !== -1) {
            this.state.currentIndex = index;
        } else {
            // Tìm index dựa trên text (fallback)
            this.state.currentIndex = this.state.comments.findIndex(c => c.text === text);
        }

        this._updateNavUI();
    },

    hideComment() {
        this.elements.popup?.classList.add("hidden");
    },

    // 3. Logic Điều hướng
    navigate(direction) {
        if (this.state.comments.length === 0) return;

        const newIndex = this.state.currentIndex + direction;
        
        // Boundary Check
        if (newIndex < 0 || newIndex >= this.state.comments.length) {
            // Hiệu ứng "kịch kim" (Vibrate nhẹ)
            if (navigator.vibrate) navigator.vibrate(50);
            return;
        }

        // Action
        this.state.currentIndex = newIndex;
        const targetComment = this.state.comments[newIndex];
        
        // 1. Show Text
        this.showComment(targetComment.text, newIndex);
        
        // 2. Scroll & Highlight (Sync với Main View)
        if (targetComment.id) {
            Scroller.scrollToId(targetComment.id);
            // Scroller.scrollToId đã bao gồm applyHighlight, nhưng nếu muốn chắc chắn:
            // Scroller.applyHighlight(targetComment.element);
        }
    },

    _updateNavUI() {
        const { btnPrev, btnNext, infoLabel } = this.elements;
        const { currentIndex, comments } = this.state;
        const total = comments.length;

        if (total === 0) {
            infoLabel.textContent = "0 / 0";
            btnPrev.disabled = true;
            btnNext.disabled = true;
            return;
        }

        infoLabel.textContent = `${currentIndex + 1} / ${total}`;
        btnPrev.disabled = currentIndex <= 0;
        btnNext.disabled = currentIndex >= total - 1;
    },

    _attachEvents() {
        const { container, popup, content, closeBtn, btnPrev, btnNext, popupBody } = this.elements;

        // Click vào marker trên văn bản
        container.addEventListener("click", (event) => {
            if (event.target.classList.contains("comment-marker")) {
                const text = event.target.dataset.comment;
                if (text) {
                    // Tìm index chính xác của marker này trong danh sách đã scan
                    // (So sánh qua dataset hoặc vị trí DOM nếu text trùng)
                    // Ở đây dùng text match đơn giản
                    const foundIndex = this.state.comments.findIndex(c => c.text === text);
                    this.showComment(text, foundIndex);
                    event.stopPropagation();
                }
            } else {
                // Click ra ngoài đóng popup
                if (!popup.classList.contains('hidden') && !popup.contains(event.target)) {
                    this.hideComment();
                }
            }
        });

        // Click Close
        closeBtn.addEventListener("click", (e) => {
            this.hideComment();
            e.stopPropagation();
        });

        // Keydown (ESC, Left, Right)
        document.addEventListener("keydown", (e) => {
            if (popup.classList.contains("hidden")) return;

            if (e.key === "Escape") this.hideComment();
            if (e.key === "ArrowLeft") this.navigate(-1);
            if (e.key === "ArrowRight") this.navigate(1);
        });

        // Nav Buttons
        btnPrev?.addEventListener("click", () => this.navigate(-1));
        btnNext?.addEventListener("click", () => this.navigate(1));

        // --- GESTURES (SWIPE) ---
        // Chỉ bắt gesture trên vùng body của popup (để không conflict với scroll dọc)
        if (popupBody) {
            popupBody.addEventListener("touchstart", (e) => {
                this.state.touchStartX = e.changedTouches[0].screenX;
                this.state.touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });

            popupBody.addEventListener("touchend", (e) => {
                const touchEndX = e.changedTouches[0].screenX;
                const touchEndY = e.changedTouches[0].screenY;
                
                this._handleSwipe(touchEndX, touchEndY);
            }, { passive: true });
        }

        // Link handling (Internal links inside comments)
        content.addEventListener("click", (event) => {
            const link = event.target.closest("a");
            if (link && link.href) {
                // ... (Logic xử lý link giữ nguyên hoặc nâng cấp sau ở Phase 2) ...
                try {
                    const urlObj = new URL(link.href);
                    if (urlObj.searchParams.has("q")) {
                        event.preventDefault();
                        let suttaId = urlObj.searchParams.get("q");
                        const urlHash = urlObj.hash; 
                        if (suttaId && urlHash) suttaId += urlHash; 
                        
                        if (suttaId && window.loadSutta) {
                            this.hideComment();
                            window.loadSutta(suttaId, true, 0);
                        }
                    }
                } catch (e) {}
            }
        });
    },

    _handleSwipe(endX, endY) {
        const startX = this.state.touchStartX;
        const startY = this.state.touchStartY;
        
        const diffX = endX - startX;
        const diffY = endY - startY;

        // Logic xác định Swipe ngang
        // 1. Độ dài vuốt ngang phải đủ lớn (> 50px)
        // 2. Độ lệch dọc phải nhỏ (để tránh nhầm với scroll đọc nội dung)
        if (Math.abs(diffX) > 50 && Math.abs(diffY) < 30) {
            if (diffX > 0) {
                // Swipe Right -> Prev
                this.navigate(-1);
            } else {
                // Swipe Left -> Next
                this.navigate(1);
            }
        }
    }
};

// Export hàm init cũ để tương thích (nếu có chỗ khác gọi) nhưng khuyến khích dùng PopupManager trực tiếp
export function initCommentPopup() {
    PopupManager.init();
    return { hideComment: () => PopupManager.hideComment() };
}