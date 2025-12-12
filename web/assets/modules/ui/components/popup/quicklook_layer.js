// Path: web/assets/modules/ui/components/popup/quicklook_layer.js
export const QuicklookLayer = {
    elements: {},

    init(callbacks) {
        this.elements = {
            popup: document.getElementById("quicklook-popup"),
            content: document.getElementById("quicklook-content"),
            title: document.getElementById("quicklook-title"),
            closeBtn: document.getElementById("close-quicklook")
        };

        if (!this.elements.popup) return;

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
        });
        
        // Click link trong Quicklook -> Load main page luôn
        this.elements.content.addEventListener("click", (e) => {
             const link = e.target.closest("a");
             if (link && link.href) {
                 e.preventDefault();
                 callbacks.onDeepLink(link.href);
             }
        });
    },

    show(htmlContent, title = "Preview") {
        this.elements.title.textContent = title;
        this.elements.content.innerHTML = htmlContent;
        this.elements.popup.classList.remove("hidden");
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        // Clear content để tiết kiệm bộ nhớ
        if (this.elements.content) this.elements.content.innerHTML = "";
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};