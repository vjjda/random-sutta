// Path: web/assets/modules/ui/managers/offline_manager.js
import { DB } from '../../data/db_manager.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("OfflineManager");
const APP_VERSION = "dev-placeholder"; // Trong thực tế, giá trị này sẽ được build system thay thế

const ICONS = {
    SYNC: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A11 11 0 0 0 12 2c-6.237 0-11.232 5.26-10.96 11.58C1.4 21.03 8.35 26 15 22.6M2.5 22v-6h6M2.66 18.5a11 11 0 0 0 19.8-7.3"></path></svg>`,
    CHECK: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    ALERT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

export const OfflineManager = {
    init() {
        const btnOffline = document.getElementById("btn-download-offline");
        
        // Tự động chạy logic kiểm tra sau khi khởi tạo 3 giây
        setTimeout(() => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => this.runSmartBackgroundDownload());
            } else {
                this.runSmartBackgroundDownload();
            }
        }, 3000);

        // Gắn sự kiện click
        if (btnOffline) {
            btnOffline.addEventListener("click", () => {
                // Xóa version cũ để ép buộc tải lại
                localStorage.removeItem('sutta_offline_version');
                this.runSmartBackgroundDownload();
            });
        }
    },

    async runSmartBackgroundDownload() {
        const storedVersion = localStorage.getItem('sutta_offline_version');
        const btnOffline = document.getElementById("btn-download-offline");
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
        };

        // Nếu đã cache phiên bản mới nhất -> DONE
        if (storedVersion === APP_VERSION) {
            logger.info("BackgroundDL", `Cache up-to-date (${APP_VERSION}).`);
            setUIState("ready", "Offline Ready", ICONS.CHECK);
            if (btnOffline) btnOffline.disabled = true;
            return;
        }

        // Nếu đang ở chế độ tiết kiệm dữ liệu -> Bỏ qua
        if (navigator.connection && navigator.connection.saveData) return;

        logger.info("BackgroundDL", "Starting silent download...");
        setUIState("syncing", "Syncing Library...", ICONS.SYNC, 0);
        if (btnOffline) btnOffline.disabled = true;

        try {
            await DB.downloadAll((current, total) => {
                const percent = Math.round((current / total) * 100);
                if (progressBar) progressBar.style.width = `${percent}%`;
                
                // Cập nhật text mỗi 20% để đỡ lag UI
                if (percent % 20 === 0 && btnOffline) {
                     const label = btnOffline.querySelector(".label");
                     if(label) label.textContent = `Syncing... ${percent}%`;
                }
            });

            localStorage.setItem('sutta_offline_version', APP_VERSION);
            setUIState("ready", "Offline Ready", ICONS.CHECK);

        } catch (e) {
            logger.error("BackgroundDL", "Sync failed", e);
            setUIState("error", "Retry Download", ICONS.ALERT, 0);
            if (btnOffline) btnOffline.disabled = false;
        }
    }
};