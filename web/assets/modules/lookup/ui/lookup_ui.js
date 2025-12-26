// Path: web/assets/modules/pali_lookup/ui/lookup_ui.js
export const LookupUI = {
    elements: {},

    init(callbacks = {}) {
        this.elements = {
            popup: document.getElementById("lookup-popup"),
            
            // Tabs
            tabDpd: document.getElementById("tab-dpd"),
            tabGnote: document.getElementById("tab-gnote"),
            title: document.getElementById("lookup-title"), // Inside tab-dpd
            closeBtn: document.getElementById("close-lookup"),
            
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
        
        // Tab Switching
        this.elements.tabDpd.addEventListener("click", () => this._switchTab('dpd'));
        this.elements.tabGnote.addEventListener("click", () => this._switchTab('gnote'));

        // Navigation
        if (this.elements.btnPrev) {
            this.elements.btnPrev.addEventListener("click", (e) => {
                e.stopPropagation();
                if (callbacks.onNavigate) callbacks.onNavigate(-1);
            });
        }
        if (this.elements.btnNext) {
            this.elements.btnNext.addEventListener("click", (e) => {
                e.stopPropagation();
                if (callbacks.onNavigate) callbacks.onNavigate(1);
            });
        }

        // Swipe Gestures
        this._setupSwipe(callbacks);
    },

    _setupSwipe(callbacks) {
        let touchStartX = 0;
        let touchStartY = 0;
        let isHorizontalSwipe = false;
        let isVerticalScroll = false;
        const minSwipeDistance = 60; // Slightly reduced as we now have lock

        this.elements.popup.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isHorizontalSwipe = false;
            isVerticalScroll = false;
        }, { passive: false }); // Allow preventDefault

        this.elements.popup.addEventListener('touchmove', (e) => {
            // Once we decided it's a scroll, stop checking
            if (isVerticalScroll) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - touchStartX;
            const diffY = currentY - touchStartY;

            // Lock logic: Decide direction early (after 10px move)
            if (!isHorizontalSwipe && !isVerticalScroll) {
                if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                    if (Math.abs(diffX) > Math.abs(diffY)) {
                        isHorizontalSwipe = true;
                    } else {
                        isVerticalScroll = true;
                    }
                }
            }

            // If locked to Horizontal -> Prevent Default (No scrolling)
            if (isHorizontalSwipe) {
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        this.elements.popup.addEventListener('touchend', (e) => {
            if (!isHorizontalSwipe) return;

            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchEndX - touchStartX;
            
            if (Math.abs(diffX) > minSwipeDistance) {
                if (diffX > 0) {
                    // Swipe Right -> Prev
                    if (callbacks.onNavigate) callbacks.onNavigate(-1);
                } else {
                    // Swipe Left -> Next
                    if (callbacks.onNavigate) callbacks.onNavigate(1);
                }
            }
        });
    },
    
    _switchTab(tabName) {
        // Deactivate all
        this.elements.tabDpd.classList.remove("active");
        this.elements.tabGnote.classList.remove("active");
        this.elements.contentDpd.classList.add("hidden");
        this.elements.contentDpd.classList.remove("active");
        this.elements.contentGnote.classList.add("hidden");
        this.elements.contentGnote.classList.remove("active");
        
        // Activate selected
        if (tabName === 'dpd') {
            this.elements.tabDpd.classList.add("active");
            this.elements.contentDpd.classList.remove("hidden");
            this.elements.contentDpd.classList.add("active");
        } else if (tabName === 'gnote') {
            this.elements.tabGnote.classList.add("active");
            this.elements.contentGnote.classList.remove("hidden");
            this.elements.contentGnote.classList.add("active");
        }
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

        // 1. Set Title (Tab Name)
        if (this.elements.title) this.elements.title.textContent = titleWord;

        // 2. Render DPD Content
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = dictHtml;

        // 3. Render G.Note Content & Toggle Tab
        if (this.elements.contentGnote) this.elements.contentGnote.innerHTML = noteHtml;
        
        if (noteHtml) {
            this.elements.tabGnote.classList.remove("hidden");
        } else {
            this.elements.tabGnote.classList.add("hidden");
        }

        // 4. Default to DPD tab
        this._switchTab('dpd');

        this.elements.popup.classList.remove("hidden");
        if (this.elements.popupBody) this.elements.popupBody.scrollTop = 0;
    },
    
    updateNavInfo(text) {
        if (this.elements.navInfo) this.elements.navInfo.textContent = text;
    },

    showLoading(title = "Searching...") {
        this.render('<div style="text-align:center; padding: 20px;">Searching...</div>', title);
        // Hide G.Note tab while searching
        if (this.elements.tabGnote) this.elements.tabGnote.classList.add("hidden");
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