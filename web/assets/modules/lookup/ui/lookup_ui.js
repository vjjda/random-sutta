// Path: web/assets/modules/pali_lookup/ui/lookup_ui.js
import { SwipeHandler } from 'ui/common/swipe_handler.js';
import { ZIndexManager } from 'ui/common/z_index_manager.js';

export const LookupUI = {
    elements: {},

    init(callbacks = {}) {
        this.elements = {
            popup: document.getElementById("lookup-popup"),
            
            // Header & Controls
            closeBtn: document.getElementById("close-lookup"),
            wordHeading: document.getElementById("lookup-word-heading"),
            btnGnote: document.getElementById("btn-toggle-gnote"),
            
            // Content
            popupBody: document.querySelector("#lookup-popup .popup-body"),
            contentDpd: document.getElementById("lookup-content-dpd"),
            contentGnote: document.getElementById("lookup-content-gnote"),

            // Nav
            btnPrev: document.getElementById("btn-lookup-prev"),
            btnNext: document.getElementById("btn-lookup-next"),
            navInfo: document.getElementById("lookup-nav-info")
        };

        if (!this.elements.popup) return;

        // [Z-INDEX] Manage stacking order
        ZIndexManager.register(this.elements.popup);

        this.elements.closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
            if (callbacks.onClose) callbacks.onClose();
        });
        
        // Prevent clicks inside popup from closing it
        this.elements.popup.addEventListener("click", (e) => {
             e.stopPropagation();
        });

        // Prevent focus loss when clicking summaries OR TABS
        this.elements.popup.addEventListener("mousedown", (e) => {
            if (e.target.closest("summary") || e.target.closest(".lookup-tab")) {
                e.preventDefault();
            }
        });
        
        // Grammar Toggle
        if (this.elements.btnGnote) {
            this.elements.btnGnote.addEventListener("click", () => {
                this.elements.contentGnote.classList.toggle("hidden");
                this.elements.btnGnote.classList.toggle("active");
            });
        }

        // Navigation
        if (this.elements.btnPrev) {
            this.elements.btnPrev.addEventListener("click", (e) => {
                e.stopPropagation();
                this.elements.btnPrev.blur(); // [UX] Remove focus to restore low-profile
                if (callbacks.onNavigate) callbacks.onNavigate(-1);
            });
        }
        if (this.elements.btnNext) {
            this.elements.btnNext.addEventListener("click", (e) => {
                e.stopPropagation();
                this.elements.btnNext.blur(); // [UX] Remove focus to restore low-profile
                if (callbacks.onNavigate) callbacks.onNavigate(1);
            });
        }

        // Swipe Gestures (Shared Handler)
        SwipeHandler.attach(this.elements.popup, {
            onSwipeLeft: () => { if (callbacks.onNavigate) callbacks.onNavigate(1); },
            onSwipeRight: () => { if (callbacks.onNavigate) callbacks.onNavigate(-1); }
        });
    },

    render(data, titleWord = "Lookup") {
        let dictHtml = "";
        let noteHtml = "";

        // Handle both simple string (loading/error) and object (results)
        if (typeof data === 'string') {
            dictHtml = data;
        } else {
            dictHtml = data.dictHtml || "";
            noteHtml = data.noteHtml || "";
        }

        // 1. Set Title (Heading Row)
        if (this.elements.wordHeading) this.elements.wordHeading.textContent = titleWord;

        // 2. Render DPD Content
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = dictHtml;

        // 3. Render G.Note Content & Toggle Button
        if (this.elements.contentGnote) {
            this.elements.contentGnote.innerHTML = noteHtml;
            // Always collapse by default when rendering new word
            this.elements.contentGnote.classList.add("hidden");
        }
        
        if (this.elements.btnGnote) {
            this.elements.btnGnote.classList.remove("active");
            if (noteHtml) {
                this.elements.btnGnote.classList.remove("hidden");
            } else {
                this.elements.btnGnote.classList.add("hidden");
            }
        }

        // [Z-INDEX] Bring to front
        ZIndexManager.bringToFront(this.elements.popup);

        this.elements.popup.classList.remove("hidden");
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;
    },
    
    updateNavInfo(text) {
        if (this.elements.navInfo) this.elements.navInfo.textContent = text;
    },

    showLoading(title = "Searching...") {
        this.render('<div style="text-align:center; padding: 20px;">Searching...</div>', title);
        // Hide G.Note trigger
        if (this.elements.btnGnote) this.elements.btnGnote.classList.add("hidden");
    },

    showError(msg) {
        this.render(`<p class="error-message">${msg}</p>`, "Error");
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = "";
        if (this.elements.contentGnote) this.elements.contentGnote.innerHTML = "";
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};