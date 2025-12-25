// Path: web/assets/modules/pali_lookup/ui/lookup_ui.js
export const LookupUI = {
    elements: {},

    init(callbacks = {}) {
        this.elements = {
            popup: document.getElementById("lookup-popup"),
            content: document.getElementById("lookup-content"),
            title: document.getElementById("lookup-title"),
            closeBtn: document.getElementById("close-lookup"),
            popupBody: document.querySelector("#lookup-popup .popup-body")
        };

        if (!this.elements.popup) return;

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
            if (callbacks.onClose) callbacks.onClose();
        });
        
        // Prevent clicks inside popup from closing it (stop propagation)
        this.elements.popup.addEventListener("click", (e) => {
             e.stopPropagation();
        });
    },

    render(htmlContent, title = "Lookup") {
        if (this.elements.title) this.elements.title.innerHTML = title;
        if (this.elements.content) this.elements.content.innerHTML = htmlContent;

        this.elements.popup.classList.remove("hidden");
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;
    },

    showLoading(title = "Searching...") {
        this.render('<div style="text-align:center; padding: 20px;">Searching...</div>', title);
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
