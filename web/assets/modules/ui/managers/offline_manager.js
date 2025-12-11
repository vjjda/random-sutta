// Path: web/assets/modules/ui/managers/offline_manager.js
import { SuttaRepository } from '../../data/sutta_repository.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("OfflineManager");
const APP_VERSION = "dev-placeholder"; // Sẽ được replace khi build

// ... (Giữ nguyên ICONS const) ...
const ICONS = {
    SYNC: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A11 11 0 0 0 12 2c-6.237 0-11.232 5.26-10.96 11.58C1.4 21.03 8.35 26 15 22.6M2.5 22v-6h6M2.66 18.5a11 11 0 0 0 19.8-7.3"></path></svg>`,
    CHECK: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    ALERT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

export const OfflineManager = {
    init() {
        // ... (Giữ nguyên phần init logic) ...
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

        if (btnUpdate) {
            btnUpdate.addEventListener("click", async (e) => {
                // ... (Giữ nguyên logic update) ...
                e.stopPropagation();
                if (confirm("Reset cache and reload to get the latest version?")) {
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
        // ... (Giữ nguyên logic showVersionInfo) ...
        const label = btnElement.querySelector(".label");
        if (!label) return;
        const stored = localStorage.getItem('sutta_offline_version') || "N/A";
        const current = APP_VERSION.replace('v', '');
        label.textContent = `Ver: ${current}`;
        setTimeout(() => {
            label.textContent = "Offline Ready";
        }, 3000);
    },

    async runSmartBackgroundDownload() {
        if (window.__DB_INDEX__ || window.location.protocol === 'file:') return;

        const storedVersion = localStorage.getItem('sutta_offline_version');
        const btnOffline = document.getElementById("btn-download-offline");
        const btnUpdate = document.getElementById("btn-update-offline");
        const wrapper = document.getElementById("offline-wrapper");
        
        // [UPDATED] Lấy thanh Global Progress Bar mới
        const globalBar = document.getElementById("global-progress-bar");

        const setUIState = (state, text, iconSvg, percent = 0) => {
            // Logic cho nút trong Drawer (giữ nguyên để đồng bộ)
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
            if (btnUpdate) {
                if (state === 'ready') btnUpdate.classList.remove('hidden');
                else btnUpdate.classList.add('hidden');
            }

            // [NEW LOGIC] Điều khiển Global Progress Bar
            if (globalBar) {
                if (state === 'syncing') {
                    globalBar.classList.add('active'); // Hiện thanh bar
                    globalBar.style.width = `${percent}%`;
                } 
                else if (state === 'ready' || state === 'error') {
                    // Khi xong, đẩy lên 100% rồi ẩn dần
                    globalBar.style.width = '100%';
                    
                    // Đợi 500ms cho user thấy 100%, sau đó fade out
                    setTimeout(() => {
                        globalBar.classList.remove('active');
                        // Reset width về 0 sau khi đã ẩn hoàn toàn (đợi transition opacity 0.3s)
                        setTimeout(() => {
                            if (!globalBar.classList.contains('active')) {
                                globalBar.style.width = '0%';
                            }
                        }, 300);
                    }, 800);
                }
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
                // Gọi setUIState để update thanh bar liên tục
                // Lưu ý: Chỉ update width, không đổi text/icon liên tục để đỡ giật
                if (globalBar) globalBar.style.width = `${percent}%`;
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