// Path: web/assets/modules/ui/components/popup/comment_layer.js
import { Scroller } from '../../common/scroller.js';

export const CommentLayer = {
    elements: {},
    
    init(callbacks) {
        this.elements = {
            popup: document.getElementById("comment-popup"),
            content: document.getElementById("comment-content"),
            headerContext: document.getElementById("comment-context-header"),
            closeBtn: document.getElementById("close-comment"),
            btnPrev: document.getElementById("btn-comment-prev"),
            btnNext: document.getElementById("btn-comment-next"),
            infoLabel: document.getElementById("comment-index-info"),
            popupBody: document.querySelector("#comment-popup .popup-body") 
        };

        if (!this.elements.popup) return;

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onClose();
        });

        if (this.elements.btnPrev) {
            this.elements.btnPrev.addEventListener("click", () => callbacks.onNavigate(-1));
        }
        if (this.elements.btnNext) {
            this.elements.btnNext.addEventListener("click", () => callbacks.onNavigate(1));
        }

        this.elements.content.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link && link.href) {
                const isSuttaCentral = link.href.includes("suttacentral.net");
                const isInternalQuery = link.href.includes("?q=");
                const isRelative = !link.href.startsWith("http");

                if (isSuttaCentral || isInternalQuery || isRelative) {
                    e.preventDefault();
                    e.stopPropagation();
                    callbacks.onLinkClick(link.href);
                }
            }
        });

        // [REMOVED] Swipe Gestures removed for stability
    },

    show(text, index, total, contextText = "") {
        if (!this.elements.content) return;
        
        this.elements.content.innerHTML = text;
        
        if (this.elements.headerContext) {
            this.elements.headerContext.textContent = contextText ? `"${contextText}"` : "";
        }

        this.elements.popup.classList.remove("hidden");
        this._updateNav(index, total);
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
    },

    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    },

    _updateNav(index, total) {
        if (total === 0 || !this.elements.infoLabel) return;
        this.elements.infoLabel.textContent = `${index + 1} / ${total}`;
        if (this.elements.btnPrev) this.elements.btnPrev.disabled = index <= 0;
        if (this.elements.btnNext) this.elements.btnNext.disabled = index >= total - 1;
    }
};