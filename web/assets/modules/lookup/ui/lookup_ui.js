// Path: web/assets/modules/lookup/ui/lookup_ui.js
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
            
            // Content
            bestMatchesContainer: document.getElementById("lookup-best-matches"),
            popupBody: document.querySelector("#lookup-popup .popup-body"),
            contentDpd: document.getElementById("lookup-content-dpd"),

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

    render(data, titleWord = "Lookup", segmentText = "", rawResults = []) {
        let dictHtml = "";

        // Handle both simple string (loading/error) and object (results)
        if (typeof data === 'string') {
            dictHtml = data;
        } else {
            dictHtml = data.dictHtml || "";
        }

        // 1. Best Matches Logic (Context Aware)
        if (this.elements.bestMatchesContainer) {
            this.elements.bestMatchesContainer.innerHTML = "";
            this.elements.bestMatchesContainer.classList.add("hidden");

            // Only proceed if we have segment context and raw results
            if (segmentText && rawResults && Array.isArray(rawResults) && rawResults.length > 0) {
                // Normalize segment text for loose matching
                // We keep spaces to ensure we don't accidentally merge words
                const normSegment = segmentText.toLowerCase().replace(/[.,;:"'‘’“”\—?!()…]/g, ' '); 
                const cleanTitle = titleWord.toLowerCase().trim();

                const bestMatches = rawResults.filter(r => {
                    const headword = r.headword || r.lookup_key || "";
                    if (!headword) return false;

                    const cleanHead = headword.toLowerCase().replace(/[.,;:"'‘’“”\—?!()…]/g, '').trim();

                    // 1. Must check equality first (Exact match exclusion)
                    if (cleanHead === cleanTitle) return false;

                    // 2. The result must CONTAIN the lookup word (Context Suggestion implies expanding on the word)
                    // e.g. Lookup "bhadante" -> Suggest "bhadante ti"
                    if (!cleanHead.includes(cleanTitle)) return false;

                    // 3. Check if phrase exists in segment
                    return normSegment.includes(cleanHead);
                });

                if (bestMatches.length > 0) {
                    this.elements.bestMatchesContainer.classList.remove("hidden");
                    
                    bestMatches.forEach(match => {
                        const div = document.createElement("div");
                        div.className = "best-match-item";
                        
                        // Highlight: Underline the lookup word inside the phrase
                        const phrase = match.headword || match.lookup_key;
                        // Escape titleWord for regex safety just in case
                        const safeTitle = titleWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(${safeTitle})`, 'gi');
                        const highlightedPhrase = phrase.replace(regex, '<u>$1</u>');
                        
                        let html = `<div class="best-match-phrase">${highlightedPhrase}</div>`;
                        if (match.meaning) {
                            html += `<span class="best-match-meaning">${match.meaning}</span>`;
                        }
                        div.innerHTML = html;
                        this.elements.bestMatchesContainer.appendChild(div);
                    });
                }
            }
        }

        // 2. Set Title (Heading Row)
        if (this.elements.wordHeading) this.elements.wordHeading.textContent = titleWord;

        // 3. Render DPD Content
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = dictHtml;

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
    },

    showError(msg, title = "Error") {
        this.render(`<p class="error-message">${msg}</p>`, title);
    },

    hide() {
        this.elements.popup?.classList.add("hidden");
        if (this.elements.contentDpd) this.elements.contentDpd.innerHTML = "";
    },
    
    isVisible() {
        return this.elements.popup && !this.elements.popup.classList.contains("hidden");
    }
};