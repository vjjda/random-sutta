// Path: web/assets/modules/ui/managers/offline_manager.js
import { SuttaRepository } from '../../data/sutta_repository.js';
import { getLogger } from '../../utils/logger.js';
import { AppConfig } from '../../core/app_config.js';

const logger = getLogger("OfflineManager");
// Placeholder này sẽ được thay thế bằng version thật khi build release
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

        // Tự động kiểm tra trạng thái sau khi app load xong (để không chặn luồng chính)
        setTimeout(() => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => this.runSmartBackgroundDownload());
            } else {
                this.runSmartBackgroundDownload();
            }
        }, 3000);

        if (btnOffline) {
            btnOffline.addEventListener("click", () => {
                const wrapper = document.getElementById("drawer-footer");
                // Nếu đã Ready -> Bấm vào để hiện Version
                if (wrapper && wrapper.classList.contains("ready")) {
                    this.showVersionInfo(btnOffline);
                } else {
                    // Nếu chưa Ready hoặc Error -> Bấm vào để thử tải lại
                    localStorage.removeItem('sutta_offline_version');
                    this.runSmartBackgroundDownload();
                }
            });
        }

        if (btnUpdate) {
            btnUpdate.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("Reset cache and reload? (Your settings will be saved)")) {
                    // 1. Backup Settings (Lưu lại cài đặt người dùng)
                    const backup = {};
                    if (AppConfig.PERSISTENT_SETTINGS) {
                        AppConfig.PERSISTENT_SETTINGS.forEach(key => {
                            const val = localStorage.getItem(key);
                            if (val !== null) backup[key] = val;
                        });
                    }

                    // 2. Factory Reset (Xóa sạch localStorage)
                    localStorage.clear();

                    // 3. Restore Settings (Khôi phục cài đặt)
                    Object.entries(backup).forEach(([key, val]) => {
                        localStorage.setItem(key, val);
                    });
                    
                    logger.info("Reset", "Settings restored:", Object.keys(backup));

                    // 4. Cleanup SW & Cache (Xóa sạch Cache Storage)
                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const reg of regs) await reg.unregister();
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

    /**
     * [NEW] Yêu cầu trình duyệt cấp quyền "Lưu trữ bền vững" (Persistent Storage).
     * Giúp dữ liệu không bị tự động xóa khi bộ nhớ máy đầy.
     */
    async tryRequestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                // Kiểm tra xem đã được cấp quyền chưa
                const isPersisted = await navigator.storage.persisted();
                if (isPersisted) {
                    logger.info("Storage", "Storage is already persistent.");
                    return true;
                }

                // Nếu chưa, xin quyền
                const granted = await navigator.storage.persist();
                if (granted) {
                    logger.info("Storage", "✅ Persistent storage granted!");
                } else {
                    logger.warn("Storage", "⚠️ Persistent storage denied. Data may be evicted under pressure.");
                }
                return granted;
            } catch (e) {
                logger.error("Storage", "Error requesting persistence", e);
                return false;
            }
        }
        return false;
    },

    showVersionInfo(btnElement) {
        const label = btnElement.querySelector(".label");
        if (!label) return;
        
        const originalText = label.textContent;
        // Chỉ hiện số phiên bản, bỏ chữ 'v' nếu có để gọn
        const current = APP_VERSION.replace('v', '');
        
        label.textContent = `v${current}`;
        
        // Tự động quay lại text cũ sau 3 giây
        setTimeout(() => {
            label.textContent = originalText;
        }, 3000);
    },

    async runSmartBackgroundDownload() {
        // Nếu là bản Offline Build (có index sẵn) hoặc chạy file:// -> Không cần tải
        if (window.__DB_INDEX__ || window.location.protocol === 'file:') return;

        const storedVersion = localStorage.getItem('sutta_offline_version');
        const btnOffline = document.getElementById("btn-download-offline");
        const globalBar = document.getElementById("global-progress-bar");

        // Nếu version đã khớp -> Ready luôn
        if (storedVersion === APP_VERSION) {
            logger.info("BackgroundDL", `Cache up-to-date.`);
            this.setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = false;
            return;
        }

        // Nếu đang bật chế độ tiết kiệm dữ liệu -> Không tự tải
        if (navigator.connection && navigator.connection.saveData) return;

        // [NEW] Xin quyền Persistent Storage trước khi bắt đầu tải nặng
        await this.tryRequestPersistence();

        logger.info("BackgroundDL", "Downloading...");
        this.setUIState("syncing", "Syncing...", ICONS.SYNC, 0);
        if (btnOffline) btnOffline.disabled = true;

        try {
            await SuttaRepository.downloadAll((current, total) => {
                const percent = (current / total * 100).toFixed(2);
                if (globalBar) globalBar.style.width = `${percent}%`;
            });

            // Tải xong -> Lưu version và cập nhật UI
            localStorage.setItem('sutta_offline_version', APP_VERSION);
            this.setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = false;

        } catch (e) {
            logger.error("BackgroundDL", "Sync failed", e);
            this.setUIState("error", "Retry", ICONS.ALERT, 0);
            if (btnOffline) btnOffline.disabled = false;
        }
    },

    setUIState(state, text, iconSvg, percent = 0) {
        const footer = document.getElementById("drawer-footer");
        const btnOffline = document.getElementById("btn-download-offline");
        const btnUpdate = document.getElementById("btn-update-offline");
        const globalBar = document.getElementById("global-progress-bar");

        if (footer) {
            footer.classList.remove("syncing", "ready", "error");
            if (state) footer.classList.add(state);
        }

        if (btnOffline) {
            const labelSpan = btnOffline.querySelector(".label");
            const iconSpan = btnOffline.querySelector(".icon");
            
            if (labelSpan) labelSpan.textContent = text;
            if (iconSpan) iconSpan.innerHTML = iconSvg;

            if (state === 'syncing') {
                btnOffline.disabled = true;
                btnOffline.style.cursor = 'wait';
            } else if (state === 'ready') {
                btnOffline.disabled = false;
                btnOffline.style.cursor = 'help';
            } else {
                btnOffline.disabled = false;
                btnOffline.style.cursor = 'pointer';
            }
        }

        if (btnUpdate) {
            if (state === 'ready') btnUpdate.classList.remove('hidden');
            else btnUpdate.classList.add('hidden');
        }

        if (globalBar) {
            if (state === 'syncing') {
                globalBar.classList.add('active');
                globalBar.style.width = `${percent}%`;
            } else if (state === 'ready' || state === 'error') {
                globalBar.style.width = '100%';
                // Hiệu ứng fade-out thanh progress bar sau khi xong
                setTimeout(() => {
                    globalBar.classList.remove('active');
                    setTimeout(() => {
                        if (!globalBar.classList.contains('active')) globalBar.style.width = '0%';
                    }, 300);
                }, 1500);
            }
        }
    }
};