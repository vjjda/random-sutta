// Path: web/assets/modules/ui/managers/read_manager.js
import { getLogger } from "utils/logger.js";
import { SuttaRepository } from "data/sutta_repository.js";

const logger = getLogger("ReadManager");

export const ReadManager = {
    STORAGE_KEY: "sutta_history",
    
    // Config: rejection probabilities for Random
    WEIGHTS: {
        0: 1.0, // 100% chance to keep
        1: 0.9, // 90%
        2: 0.7, // 70%
        3: 0.5, // 50%
        4: 0.3, // 30%
        5: 0.1  // 10%
    },

    init() {
        logger.info("Init", "Initializing ReadManager...");

        // Listen for external sync updates
        window.addEventListener("sync-data-applied", () => {
            logger.info("Sync", "Sync data applied, re-rendering list");
            this.renderList();
            
            // Also need to update the familiarity bar UI for the current sutta if open
            const params = new URLSearchParams(window.location.search);
            const currentId = params.get("q");
            if (currentId && window.FamiliarityBar) {
                 const baseId = currentId.split('#')[0];
                 const level = this.getFamiliarity(baseId);
                 window.FamiliarityBar.updateUIState(baseId, level);
            }
        });

        this.tabToc = document.getElementById("tab-magic-toc");
        this.tabBookmarks = document.getElementById("tab-magic-bookmarks");
        this.tabRead = document.getElementById("tab-magic-read");
        
        this.contentToc = document.getElementById("magic-toc-content");
        this.contentBookmarks = document.getElementById("magic-bookmarks-content");
        this.contentRead = document.getElementById("magic-read-content");
        this.listContainer = document.getElementById("read-list");

        if (this.tabRead) {
            this.tabRead.onclick = () => this.switchTab("read");
        }

        // We also need to hook into the other tabs to handle switching
        if (this.tabToc) {
            const oldTocClick = this.tabToc.onclick;
            this.tabToc.onclick = (e) => {
                if (oldTocClick) oldTocClick(e);
                this.switchTab("toc");
            };
        }
        if (this.tabBookmarks) {
            const oldBmClick = this.tabBookmarks.onclick;
            this.tabBookmarks.onclick = (e) => {
                if (oldBmClick) oldBmClick(e);
                this.switchTab("bookmarks");
            };
        }

        this.renderList();
    },

    switchTab(tab) {
        if (!this.tabToc || !this.tabBookmarks || !this.tabRead) return;
        
        this.tabToc.classList.remove("active");
        this.tabBookmarks.classList.remove("active");
        this.tabRead.classList.remove("active");
        
        this.contentToc.classList.add("hidden");
        this.contentBookmarks.classList.add("hidden");
        this.contentRead.classList.add("hidden");

        if (tab === "read") {
            this.tabRead.classList.add("active");
            this.contentRead.classList.remove("hidden");
            this.renderList();
        } else if (tab === "toc") {
            this.tabToc.classList.add("active");
            this.contentToc.classList.remove("hidden");
        } else if (tab === "bookmarks") {
            this.tabBookmarks.classList.add("active");
            this.contentBookmarks.classList.remove("hidden");
        }
    },

    getHistory() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            let history = data ? JSON.parse(data) : {};

            // [MIGRATION] Convert Object format to Array format [level, timestamp]
            let migrated = false;
            Object.keys(history).forEach(uid => {
                const item = history[uid];
                
                // If it's the old object format
                if (typeof item === 'object' && !Array.isArray(item)) {
                    const level = item.level !== undefined ? item.level : 0;
                    const ts = item.timestamp || Date.now();
                    history[uid] = [level, ts];
                    migrated = true;
                }
            });

            if (migrated) {
                logger.info("Migration", "Migrated history to Array format [level, timestamp]");
                this.saveHistory(history);
            }

            return history;
        } catch (e) {
            logger.warn("Storage Error", e);
            return {};
        }
    },

    saveHistory(history) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    },

    getFamiliarity(id) {
        if (!id) return 0;
        const baseId = id.split('#')[0];
        const history = this.getHistory();
        const item = history[baseId];
        if (!item) return 0;
        
        // Handle both new Array format and safety fallback
        const level = Array.isArray(item) ? item[0] : (item.level || 0);
        return level > 0 ? level : 0;
    },

    getKeepProbability(id) {
        const level = this.getFamiliarity(id);
        return this.WEIGHTS[level] !== undefined ? this.WEIGHTS[level] : 1.0;
    },

    setFamiliarity(id, level, skipRender = false) {
        if (!id) return;
        const baseId = id.split('#')[0];
        const history = this.getHistory();
        const now = Date.now();
        
        // Always store as [level, timestamp]
        history[baseId] = [level, now];
        
        if (level === 0) {
            logger.info("Familiarity", `Removed (tombstone level 0): ${baseId}`);
        } else {
            logger.info("Familiarity", `Set: ${baseId} to level ${level}`);
        }
        
        this.saveHistory(history);
        window.dispatchEvent(new CustomEvent("local-data-changed"));
        
        if (!skipRender) this.renderList();
        
        if (window.MagicNav) {
            window.MagicNav.updateHistoryState(baseId, level);
        }
    },

    // [NEW] Helper cập nhật DOM tại chỗ trong History List
    _updateItemDOM(itemEl, newLevel) {
        // Xóa class fam-level-* cũ
        for (let i = 1; i <= 5; i++) {
            itemEl.classList.remove(`fam-level-${i}`);
        }
        // Thêm class mới
        if (newLevel > 0) itemEl.classList.add(`fam-level-${newLevel}`);
        // Cập nhật attribute để lần click tiếp theo biết level hiện tại
        itemEl.setAttribute("data-level", newLevel);
    },

    async renderList() {
        if (!this.listContainer) return;
        const history = this.getHistory();
        
        // entries structure: [uid, [level, timestamp]]
        const entries = Object.entries(history).filter(([uid, data]) => {
            const level = Array.isArray(data) ? data[0] : data.level;
            return level > 0;
        });
        
        if (entries.length === 0) {
            this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No history yet.</div>`;
            return;
        }

        // Fetch metadata for all UIDs
        const uids = entries.map(([uid]) => uid);
        const metaList = await SuttaRepository.fetchMetaList(uids);

        // Group by Date extracted from timestamp
        const grouped = {};
        entries.forEach(([uid, data]) => {
            const [level, timestamp] = Array.isArray(data) ? data : [data.level, data.timestamp];
            const dateStr = new Date(timestamp).toISOString().split('T')[0];
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push({ uid, level, timestamp });
        });

        // Sort dates descending
        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

        let html = "";
        for (const date of sortedDates) {
            const items = grouped[date];
            // Sort items within a date by timestamp descending (most recent first)
            items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            // Format date for display
            const displayDate = new Date(date).toLocaleDateString(undefined, { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });

            html += `<div class="read-date-header">${displayDate}</div>`;
            
            html += items.map(b => {
                const meta = metaList[b.uid] || {};
                const displayAcronym = meta.acronym || b.uid.toUpperCase();
                const displayTitle = meta.translated_title || "";
                const displayOriginal = meta.original_title || "";
                
                return `
                    <div class="read-item fam-level-${b.level}" data-id="${b.uid}" data-level="${b.level}">
                        <div class="read-indicator"></div>
                        <div class="read-info">
                            <div class="read-id">
                                <span class="id-acronym">${displayAcronym}</span>
                                ${displayOriginal ? `<span class="id-original">${displayOriginal}</span>` : ''}
                            </div>
                            ${displayTitle ? `<div class="read-title">${displayTitle}</div>` : ''}
                        </div>
                        <button class="read-del-btn" title="Remove">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                `;
            }).join("");
        }

        this.listContainer.innerHTML = html;

        // Add event listeners
        this.listContainer.querySelectorAll(".read-item").forEach(item => {
            const uid = item.getAttribute("data-id");

            // Click logic
            item.onclick = (e) => {
                if (e.target.closest(".read-del-btn")) {
                    e.stopPropagation();
                    this.setFamiliarity(uid, 0, false);
                    if (window.FamiliarityBar) window.FamiliarityBar.updateUIState(uid, 0);
                    return;
                }
                
                // Close drawer logic
                const drawer = document.getElementById("magic-toc-drawer");
                const backdrop = document.getElementById("magic-backdrop");
                const wrapper = document.getElementById("magic-nav-wrapper");
                if (drawer) drawer.classList.remove("open");
                if (backdrop) backdrop.classList.add("hidden");
                if (wrapper) wrapper.classList.add("collapsed");
                
                if (window.loadSutta) {
                    window.loadSutta(uid, true);
                }
            };
        });
    }
};
