// Path: web/assets/modules/ui/managers/offline/index.js
import { getLogger } from "utils/logger.js";
import { OfflineService, APP_VERSION } from "./offline_service.js";
import { OfflineView } from "./offline_view.js";

const logger = getLogger("OfflineManager");

export const OfflineManager = {
    init() {
        window.OfflineManager = this;
        const els = OfflineView.init();

        // Auto-download check delay
        setTimeout(() => {
            const runner = () => this.runSmartBackgroundDownload();
            if ('requestIdleCallback' in window) requestIdleCallback(runner);
            else runner();
        }, 3000);

        if (els.btnDownload) {
            els.btnDownload.addEventListener("click", () => this._handleDownloadClick());
        }

        if (els.btnUpdate) {
            // [UPDATED] Update Button Handler triggers Smart Update
            els.btnUpdate.addEventListener("click", (e) => this._handleUpdateClick(e));
        }
    },

    async _handleDownloadClick() {
        if (OfflineService.isOfflineReady()) {
            OfflineView.flashVersion(APP_VERSION);
            this.checkQuota();
        } else {
            localStorage.removeItem('sutta_offline_version');
            this.runSmartBackgroundDownload();
        }
    },

    // [NEW] Smart Update Handler
    async _handleUpdateClick(e) {
        e.stopPropagation();
        
        // Confirm text rõ ràng hơn cho người dùng
        if (confirm("Check for updates? The app will refresh.")) {
            logger.info("Update", "Triggering smart update...");
            
            // Visual Feedback: Disable nút để tránh double click
            const btn = e.currentTarget;
            btn.style.opacity = "0.5";
            btn.style.pointerEvents = "none";
            
            // Chạy logic cập nhật
            await OfflineService.smartUpdate();
            
            // Reload trang để áp dụng Code mới (hoặc tải lại DB nếu cần)
            window.location.reload();
        }
    },

    async runSmartBackgroundDownload() {
        // Skip if running in 'Serverless' build mode (pre-injected data) or file protocol
        if (window.__DB_INDEX__ || window.location.protocol === 'file:') return;

        if (OfflineService.isOfflineReady()) {
            logger.info("BackgroundDL", `Cache up-to-date.`);
            OfflineView.renderState('ready', "Offline Ready");
            this.checkQuota(); 
            return;
        }

        if (navigator.connection && navigator.connection.saveData) return;

        logger.info("BackgroundDL", "Downloading...");
        OfflineView.renderState('syncing', "Syncing...");
        
        try {
            await OfflineService.performFullDownload((current, total) => {
                const percent = (current / total * 100).toFixed(2);
                OfflineView.renderState('syncing', "Syncing...", percent);
            });
            
            OfflineView.renderState('ready', "Offline Ready");
            this.checkQuota();

        } catch (e) {
            logger.error("BackgroundDL", "Sync failed", e);
            OfflineView.renderState('error', "Retry");
        }
    },

    async checkQuota() {
        const info = await OfflineService.checkQuota();
        if (info) {
            logger.info("Quota", `Storage Used: ${info.usedMB} MB / ${info.quotaMB} MB (${info.percent}%)`);
        }
    }
};