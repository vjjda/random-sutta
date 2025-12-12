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
            popupBody: document.querySelector("#quicklook-popup .popup-body")
        };

        if (!this.elements.popup) return;

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
        });
        
        this.elements.content.addEventListener("click", (e) => {
             const link = e.target.closest("a");
             if (link && link.href) {
                 e.preventDefault();
                 callbacks.onDeepLink(link.href);
             }
        });
    },

    show(htmlContent, title = "Preview") {
        if (this.elements.title) {
            this.elements.title.textContent = title;
        }
        this.elements.content.innerHTML = htmlContent;
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