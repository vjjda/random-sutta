// Path: web/assets/modules/ui/components/popup/ui/quicklook_ui.js
export const QuicklookUI = {
    elements: {},

    init(callbacks) {
        this.elements = {
            popup: document.getElementById("quicklook-popup"),
            content: document.getElementById("quicklook-content"),
            title: document.getElementById("quicklook-title"),
            closeBtn: document.getElementById("close-quicklook"),
            popupBody: document.querySelector("#quicklook-popup .popup-body"),
            externalLinkBtn: document.getElementById("btn-quicklook-open")
        };

        if (!this.elements.popup) return;

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onClose();
        });

        if (this.elements.externalLinkBtn) {
            this.elements.externalLinkBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (callbacks.onOpenOriginal && this.elements.externalLinkBtn.href) {
                    callbacks.onOpenOriginal(this.elements.externalLinkBtn.href);
                }
            });
        }
        
        this.elements.content.addEventListener("click", (e) => {
             const link = e.target.closest("a");
             if (link && link.href) {
                 e.preventDefault();
                 callbacks.onDeepLink(link.href);
             }
        });
    },

    render(htmlContent, title = "Preview", sourceUrl = null) {
        if (this.elements.title) this.elements.title.innerHTML = title;
        this.elements.content.innerHTML = htmlContent;

        if (this.elements.externalLinkBtn) {
            if (sourceUrl) {
                this.elements.externalLinkBtn.href = sourceUrl;
                this.elements.externalLinkBtn.classList.remove("hidden");
            } else {
                this.elements.externalLinkBtn.classList.add("hidden");
            }
        }

        this.elements.popup.classList.remove("hidden");
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;
    },

    showLoading(title = "Loading...") {
        this.render('<div style="text-align:center; padding: 20px;">Loading...</div>', title);
    },

    showError(msg) {
        this.render(`<p class="error-message">${msg}</p>`, "Error");
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        if (this.elements.content) this.elements.content.innerHTML = "";
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};