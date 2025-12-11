// Path: web/assets/modules/ui/managers/offline_manager.js
import { SuttaRepository } from '../../data/sutta_repository.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("OfflineManager");
const APP_VERSION = "dev-placeholder"; // Sẽ được replace khi build

const ICONS = {
    SYNC: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A11 11 0 0 0 12 2c-6.237 0-11.232 5.26-10.96 11.58C1.4 21.03 8.35 26 15 22.6M2.5 22v-6h6M2.66 18.5a11 11 0 0 0 19.8-7.3"></path></svg>`,
    CHECK: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    ALERT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

export const OfflineManager = {
    init() {
        const btnOffline = document.getElementById("btn-download-offline");
        const btnUpdate = document.getElementById("btn-update-offline");

        // Delay checking to avoid blocking main thread on startup
        setTimeout(() => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => this.runSmartBackgroundDownload());
            } else {
                this.runSmartBackgroundDownload();
            }
        }, 3000);

        if (btnOffline) {
            btnOffline.addEventListener("click", () => {
                const wrapper = document.getElementById("offline-wrapper");
                if (wrapper && wrapper.classList.contains("ready")) {
                    this.showVersionInfo(btnOffline);
                } else {
                    // Start download
                    localStorage.removeItem('sutta_offline_version');
                    this.runSmartBackgroundDownload();
                }
            });
        }

        if (btnUpdate) {
            btnUpdate.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("Reset cache and reload to get the latest version?")) {
                    // Reset Logic
                    localStorage.removeItem('sutta_offline_version');
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations) await registration.unregister();
                    }
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        for (const key of keys) await caches.delete(key);
                    }
                    window.location.reload();
                }
            });
        }
    },

    showVersionInfo(btnElement) {
        const label = btnElement.querySelector(".label");
        if (!label) return;
        
        // Show version temporarily
        const originalText = label.textContent;
        const stored = localStorage.getItem('sutta_offline_version') || "N/A";
        const current = APP_VERSION.replace('v', '');
        
        label.textContent = `Ver: ${current}`;
        
        // Revert after 3s
        setTimeout(() => {
            label.textContent = originalText;
        }, 3000);
    },

    async runSmartBackgroundDownload() {
        if (window.__DB_INDEX__ || window.location.protocol === 'file:') return;

        const storedVersion = localStorage.getItem('sutta_offline_version');
        const btnOffline = document.getElementById("btn-download-offline");
        const globalBar = document.getElementById("global-progress-bar");

        if (storedVersion === APP_VERSION) {
            logger.info("BackgroundDL", `Cache up-to-date (${APP_VERSION}).`);
            this.setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = false;
            return;
        }

        if (navigator.connection && navigator.connection.saveData) return;

        logger.info("BackgroundDL", "Starting silent download...");
        this.setUIState("syncing", "Syncing Library...", ICONS.SYNC, 0);
        
        if (btnOffline) btnOffline.disabled = true;

        try {
            await SuttaRepository.downloadAll((current, total) => {
                const percent = (current / total * 100).toFixed(2);
                if (globalBar) globalBar.style.width = `${percent}%`;
            });

            localStorage.setItem('sutta_offline_version', APP_VERSION);
            this.setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = false;

        } catch (e) {
            logger.error("BackgroundDL", "Sync failed", e);
            this.setUIState("error", "Retry Download", ICONS.ALERT, 0);
            if (btnOffline) btnOffline.disabled = false;
        }
    },

    setUIState(state, text, iconSvg, percent = 0) {
        // [UPDATED] Đổi ID selector
        const footer = document.getElementById("drawer-footer");
        const btnOffline = document.getElementById("btn-download-offline");
        const btnUpdate = document.getElementById("btn-update-offline");
        const globalBar = document.getElementById("global-progress-bar");

        // 1. Footer State
        if (footer) {
            footer.classList.remove("syncing", "ready", "error");
            if (state) footer.classList.add(state);
        }

        // 2. Main Button Content
        if (btnOffline) {
            const labelSpan = btnOffline.querySelector(".label");
            const iconSpan = btnOffline.querySelector(".icon");
            
            if (labelSpan) labelSpan.textContent = text;
            if (iconSpan) iconSpan.innerHTML = iconSvg;
            
            // Button Interaction Logic
            if (state === 'syncing') {
                btnOffline.disabled = true;
                btnOffline.style.cursor = 'wait';
            } else if (state === 'ready') {
                // In Ready state, button acts as status label (clickable for version)
                btnOffline.disabled = false; 
                btnOffline.style.cursor = 'help';
            } else {
                // Default/Error state -> Action button
                btnOffline.disabled = false;
                btnOffline.style.cursor = 'pointer';
            }
        }

        // 3. Update Button Visibility
        // (CSS handles most of this via wrapper classes, but explicit hidden helps prevent clicks)
        if (btnUpdate) {
            if (state === 'ready') btnUpdate.classList.remove('hidden');
            else btnUpdate.classList.add('hidden');
        }

        // 4. Global Progress Bar
        if (globalBar) {
            if (state === 'syncing') {
                globalBar.classList.add('active');
                globalBar.style.width = `${percent}%`;
            } 
            else if (state === 'ready' || state === 'error') {
                globalBar.style.width = '100%';
                setTimeout(() => {
                    globalBar.classList.remove('active');
                    setTimeout(() => {
                        if (!globalBar.classList.contains('active')) {
                            globalBar.style.width = '0%';
                        }
                    }, 300);
                }, 1500);
            }
        }
    }
};