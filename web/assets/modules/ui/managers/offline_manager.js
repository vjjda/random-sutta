// Path: web/assets/modules/ui/managers/offline_manager.js
import { SuttaRepository } from '../../data/sutta_repository.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("OfflineManager");
const APP_VERSION = "dev-placeholder"; 

const ICONS = {
    SYNC: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A11 11 0 0 0 12 2c-6.237 0-11.232 5.26-10.96 11.58C1.4 21.03 8.35 26 15 22.6M2.5 22v-6h6M2.66 18.5a11 11 0 0 0 19.8-7.3"></path></svg>`,
    CHECK: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    ALERT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

export const OfflineManager = {
    init() {
        const btnOffline = document.getElementById("btn-download-offline");
        const btnUpdate = document.getElementById("btn-update-offline");

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
                    localStorage.removeItem('sutta_offline_version');
                    this.runSmartBackgroundDownload();
                }
            });
        }

        // [FIX] Update Button Logic
        if (btnUpdate) {
            btnUpdate.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("Reset cache and reload to get the latest version?")) {
                    // 1. Clear LocalStorage Flag
                    localStorage.removeItem('sutta_offline_version');
                    
                    // 2. Unregister Service Workers
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations) {
                            await registration.unregister();
                        }
                    }

                    // 3. Clear Cache Storage (Quan trọng)
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        for (const key of keys) {
                            await caches.delete(key);
                        }
                    }

                    // 4. Hard Reload page
                    window.location.reload();
                }
            });
        }
    },

    showVersionInfo(btnElement) {
        const label = btnElement.querySelector(".label");
        if (!label) return;

        // [FIX] Hiển thị cả APP_VERSION thực tế (từ code) để đối chiếu
        const stored = localStorage.getItem('sutta_offline_version') || "N/A";
        const current = APP_VERSION.replace('v', '');
        
        label.textContent = `Ver: ${current}`; // Ưu tiên hiện version của code đang chạy
        
        setTimeout(() => {
            label.textContent = "Offline Ready";
        }, 3000);
    },

    async runSmartBackgroundDownload() {
        // [NEW] Skip download in hard offline mode (Data already injected)
        if (window.__DB_INDEX__ || window.location.protocol === 'file:') {
            return;
        }

        const storedVersion = localStorage.getItem('sutta_offline_version');
        const btnOffline = document.getElementById("btn-download-offline");
        const btnUpdate = document.getElementById("btn-update-offline");
        const progressBar = document.getElementById("offline-progress-bar");
        const wrapper = document.getElementById("offline-wrapper");

        const setUIState = (state, text, iconSvg, percent = 0) => {
            if (wrapper) {
                wrapper.classList.remove("syncing", "ready", "error");
                if (state) wrapper.classList.add(state);
            }
            if (btnOffline) {
                const iconSpan = btnOffline.querySelector(".icon");
                const labelSpan = btnOffline.querySelector(".label");
                if (iconSpan) iconSpan.innerHTML = iconSvg;
                if (labelSpan) labelSpan.textContent = text;
            }
            if (progressBar) {
                progressBar.style.width = `${percent}%`;
            }
            
            if (btnUpdate) {
                if (state === 'ready') btnUpdate.classList.remove('hidden');
                else btnUpdate.classList.add('hidden');
            }
        };

        if (storedVersion === APP_VERSION) {
            logger.info("BackgroundDL", `Cache up-to-date (${APP_VERSION}).`);
            setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = false;
            return;
        }

        if (navigator.connection && navigator.connection.saveData) return;

        logger.info("BackgroundDL", "Starting silent download...");
        setUIState("syncing", "Syncing Library...", ICONS.SYNC, 0);
        
        if (btnOffline) btnOffline.disabled = true;

        try {
            await SuttaRepository.downloadAll((current, total) => {
                const percent = (current / total * 100).toFixed(2);
                if (progressBar) progressBar.style.width = `${percent}%`;
            });

            localStorage.setItem('sutta_offline_version', APP_VERSION);
            setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = false;
        } catch (e) {
            logger.error("BackgroundDL", "Sync failed", e);
            setUIState("error", "Retry Download", ICONS.ALERT, 0);
            if (btnOffline) btnOffline.disabled = false;
        }
    }
};