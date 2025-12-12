// Path: web/assets/modules/ui/components/popup/comment_layer.js
import { Scroller } from '../../common/scroller.js';

export const CommentLayer = {
    elements: {},
    
    init(callbacks) {
        this.elements = {
            popup: document.getElementById("comment-popup"),
            content: document.getElementById("comment-content"),
            closeBtn: document.getElementById("close-comment"),
            btnPrev: document.getElementById("btn-comment-prev"),
            btnNext: document.getElementById("btn-comment-next"),
            infoLabel: document.getElementById("comment-index-info"),
            popupBody: document.querySelector("#comment-popup .popup-body") 
        };

        if (!this.elements.popup) return;

        // Events
        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onClose();
        });

        this.elements.btnPrev.addEventListener("click", () => callbacks.onNavigate(-1));
        this.elements.btnNext.addEventListener("click", () => callbacks.onNavigate(1));

        // Intercept Links -> Quicklook
        this.elements.content.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link && link.href) {
                // Kiểm tra nếu là link nội bộ (suttacentral hoặc relative)
                if (link.href.includes("suttacentral.net") || !link.href.startsWith("http")) {
                    e.preventDefault();
                    e.stopPropagation();
                    callbacks.onLinkClick(link.href);
                }
            }
        });

        // Swipe Gestures
        let startX = 0, startY = 0;
        this.elements.popupBody.addEventListener("touchstart", (e) => {
            startX = e.changedTouches[0].screenX;
            startY = e.changedTouches[0].screenY;
        }, { passive: true });

        this.elements.popupBody.addEventListener("touchend", (e) => {
            const diffX = e.changedTouches[0].screenX - startX;
            const diffY = e.changedTouches[0].screenY - startY;
            if (Math.abs(diffX) > 50 && Math.abs(diffY) < 30) {
                callbacks.onNavigate(diffX > 0 ? -1 : 1);
            }
        }, { passive: true });
    },

    show(text, index, total) {
        this.elements.content.innerHTML = text;
        this.elements.popup.classList.remove("hidden");
        this._updateNav(index, total);
    },

    hide() {
        this.elements.popup.classList.add("hidden");
    },

    isVisible() {
        return !this.elements.popup.classList.contains("hidden");
    },

    _updateNav(index, total) {
        if (total === 0) return;
        this.elements.infoLabel.textContent = `${index + 1} / ${total}`;
        this.elements.btnPrev.disabled = index <= 0;
        this.elements.btnNext.disabled = index >= total - 1;
    }
};