// Path: web/assets/modules/ui/components/popup/quicklook_layer.js
export const QuicklookLayer = {
    elements: {},

    init(callbacks) {
        this.elements = {
            popup: document.getElementById("quicklook-popup"),
            content: document.getElementById("quicklook-content"),
            title: document.getElementById("quicklook-title"),
            closeBtn: document.getElementById("close-quicklook"),
            // [NEW] Cache element body để xử lý scroll
            popupBody: document.querySelector("#quicklook-popup .popup-body"),
            externalLinkBtn: document.getElementById("btn-quicklook-open")
        };

        if (!this.elements.popup) return;

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
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

    show(htmlContent, title = "Preview", sourceUrl = null) {
        if (this.elements.title) {
            this.elements.title.innerHTML = title;
        }
        this.elements.content.innerHTML = htmlContent;
        
        // Handle External Link Button
        if (this.elements.externalLinkBtn) {
            if (sourceUrl) {
                this.elements.externalLinkBtn.href = sourceUrl;
                this.elements.externalLinkBtn.classList.remove("hidden");
            } else {
                this.elements.externalLinkBtn.classList.add("hidden");
                this.elements.externalLinkBtn.removeAttribute("href");
            }
        }

        this.elements.popup.classList.remove("hidden");

        // [FIXED] Reset scroll position lên đầu khi load nội dung mới
        if (this.elements.popupBody) {
            this.elements.popupBody.scrollTop = 0;
        }
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        if (this.elements.content) this.elements.content.innerHTML = "";
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};