// Path: web/assets/modules/ui/managers/offline_service.js
import { SuttaRepository } from '../../data/sutta_repository.js';
import { getLogger } from '../../utils/logger.js';
import { AppConfig } from '../../core/app_config.js';

const logger = getLogger("OfflineService");
export const APP_VERSION = "dev-placeholder"; // Export để View dùng

export const OfflineService = {
    isOfflineReady() {
        return localStorage.getItem('sutta_offline_version') === APP_VERSION;
    },

    async requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persisted();
                if (isPersisted) return true;
                return await navigator.storage.persist();
            } catch (e) {
                logger.error("Storage", "Error requesting persistence", e);
                return false;
            }
        }
        return false;
    },

    async checkQuota() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const { usage, quota } = await navigator.storage.estimate();
                return {
                    usedMB: (usage / (1024 * 1024)).toFixed(2),
                    quotaMB: (quota / (1024 * 1024)).toFixed(2),
                    percent: ((usage / quota) * 100).toFixed(1)
                };
            } catch (e) {
                logger.warn("Quota", "Estimate failed", e);
            }
        }
        return null;
    },

    async performFullDownload(onProgress) {
        // [Logic] Xin quyền trước khi tải
        await this.requestPersistentStorage();
        
        await SuttaRepository.downloadAll(onProgress);
        
        // [Logic] Lưu đánh dấu phiên bản
        localStorage.setItem('sutta_offline_version', APP_VERSION);
    },

    async factoryReset() {
        // 1. Backup
        const backup = {};
        if (AppConfig.PERSISTENT_SETTINGS) {
            AppConfig.PERSISTENT_SETTINGS.forEach(key => {
                const val = localStorage.getItem(key);
                if (val !== null) backup[key] = val;
            });
        }

        // 2. Clear
        localStorage.clear();

        // 3. Restore
        Object.entries(backup).forEach(([key, val]) => {
            localStorage.setItem(key, val);
        });

        // 4. Wipe Cache Storage
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) await reg.unregister();
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) await caches.delete(key);
        }
    }
};