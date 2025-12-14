// Path: web/assets/modules/ui/components/popup/comment_popup_ui.js
export const CommentPopupUI = {
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

        // Horizontal scroll for header text
        if (this.elements.headerContext) {
            this.elements.headerContext.addEventListener("wheel", (e) => {
                if (this.elements.headerContext.scrollWidth > this.elements.headerContext.clientWidth) {
                    e.preventDefault();
                    this.elements.headerContext.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

        this.elements.content.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link && link.href) {
                // Check internal links
                const isInternal = link.href.includes("suttacentral.net") || link.href.includes("?q=") || !link.href.startsWith("http");
                if (isInternal) {
                    e.preventDefault();
                    e.stopPropagation();
                    callbacks.onLinkClick(link.href);
                }
            }
        });
    },

    render(text, index, total, contextText = "") {
        if (!this.elements.content) return;
        this.elements.content.innerHTML = text;
        
        if (this.elements.headerContext) {
            this.elements.headerContext.textContent = contextText ? `"${contextText}"` : "";
            this.elements.headerContext.scrollLeft = 0;
        }

        this.elements.popup.classList.remove("hidden");
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;

        this._updateNav(index, total);
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
    },

    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    },

    _updateNav(index, total) {
        if (!this.elements.infoLabel) return;
        this.elements.infoLabel.textContent = `${index + 1} / ${total}`;
        if (this.elements.btnPrev) this.elements.btnPrev.disabled = index <= 0;
        if (this.elements.btnNext) this.elements.btnNext.disabled = index >= total - 1;
    }
};