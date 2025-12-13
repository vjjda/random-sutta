// Path: web/assets/modules/ui/managers/offline_manager.js
import { getLogger } from '../../utils/logger.js';
import { OfflineService, APP_VERSION } from './offline_service.js';
import { OfflineView } from './offline_view.js';

const logger = getLogger("OfflineManager");

export const OfflineManager = {
    init() {
        // Expose debug
        window.OfflineManager = this;
        
        // Init View
        const els = OfflineView.init();

        // Auto-check on startup
        setTimeout(() => {
            const runner = () => this.runSmartBackgroundDownload();
            if ('requestIdleCallback' in window) requestIdleCallback(runner);
            else runner();
        }, 3000);

        // Bind Events
        if (els.btnDownload) {
            els.btnDownload.addEventListener("click", () => this._handleDownloadClick());
        }

        if (els.btnUpdate) {
            els.btnUpdate.addEventListener("click", (e) => this._handleResetClick(e));
        }
    },

    async _handleDownloadClick() {
        // Nếu đang ở trạng thái Ready -> Hiển thị version & Quota
        if (OfflineService.isOfflineReady()) {
            OfflineView.flashVersion(APP_VERSION);
            this.checkQuota();
        } else {
            // Nếu chưa -> Thử tải lại (Retry)
            localStorage.removeItem('sutta_offline_version');
            this.runSmartBackgroundDownload();
        }
    },

    async _handleResetClick(e) {
        e.stopPropagation();
        if (confirm("Reset cache and reload? (Your settings will be saved)")) {
            logger.info("Reset", "Starting factory reset...");
            await OfflineService.factoryReset();
            window.location.reload();
        }
    },

    async runSmartBackgroundDownload() {
        // 1. Check môi trường (File protocol hoặc Offline Build thì bỏ qua)
        if (window.__DB_INDEX__ || window.location.protocol === 'file:') return;

        // 2. Check trạng thái Ready
        if (OfflineService.isOfflineReady()) {
            logger.info("BackgroundDL", `Cache up-to-date.`);
            OfflineView.renderState('ready', "Offline Ready");
            this.checkQuota(); // Tiện thể check quota luôn
            return;
        }

        // 3. Check Data Saver
        if (navigator.connection && navigator.connection.saveData) return;

        // 4. Start Download Process
        logger.info("BackgroundDL", "Downloading...");
        OfflineView.renderState('syncing', "Syncing...");

        try {
            await OfflineService.performFullDownload((current, total) => {
                const percent = (current / total * 100).toFixed(2);
                OfflineView.renderState('syncing', "Syncing...", percent);
            });

            // Success
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