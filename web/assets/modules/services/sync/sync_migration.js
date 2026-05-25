// Path: web/assets/modules/services/sync/sync_migration.js
import { getLogger } from "utils/logger.js";
import { GithubSync } from "services/sync/github_sync.js";

const logger = getLogger("SyncMigration");

export const SyncMigration = {
    _showMigrationToast(message, isCompleted = false) {
        let toast = document.getElementById("sync-migration-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "sync-migration-toast";
            toast.className = "sync-migration-toast";
            document.body.appendChild(toast);
        }
        
        toast.classList.remove("hide");
        
        if (isCompleted) {
            toast.innerHTML = `<svg class="sync-success-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${message}`;
            setTimeout(() => {
                toast.classList.add("hide");
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        } else {
            toast.innerHTML = `<div class="sync-spinner"></div> ${message}`;
        }
    },

    async checkAndCleanLegacy(onForcePushRequired, SETTING_KEYS) {
        const legacySha = localStorage.getItem("sync_github_sha");
        if (legacySha) {
            logger.info("Legacy", "Found local legacy sync_github_sha, will clear it.");
            localStorage.removeItem("sync_github_sha");
        }
        
        try {
            const legacyRes = await GithubSync.downloadData("sync.json");
            if (legacyRes) {
                logger.info("Legacy", "Found sync.json on GitHub. Migrating data...");
                this._showMigrationToast("Migrating sync format. Please wait...", false);
                
                // 1. Unpack legacy data and save to localStorage
                const legacyData = legacyRes.data;
                const payload = legacyData.payload || legacyData;
                
                Object.entries(payload).forEach(([key, value]) => {
                    if (SETTING_KEYS.includes(key) || key === "sutta_bookmarks" || key === "sutta_history") {
                         // Fallback migrations for bookmarks and history
                         if (key === "sutta_bookmarks") {
                            let converted = {};
                            if (Array.isArray(value)) {
                                value.forEach(b => {
                                    const uid = b.uid || b.id;
                                    if (uid) converted[uid] = (b.status !== false) ? Math.abs(b.timestamp || Date.now()) : -Math.abs(b.timestamp || Date.now());
                                });
                            } else {
                                Object.entries(value).forEach(([uid, item]) => {
                                     if (typeof item === 'object') {
                                         converted[uid] = (item.status !== false) ? Math.abs(item.timestamp || 0) : -Math.abs(item.timestamp || 0);
                                     } else {
                                         converted[uid] = item; // Already a number
                                     }
                                });
                            }
                            localStorage.setItem(key, JSON.stringify(converted));
                         } else if (key === "sutta_history") {
                            let converted = {};
                            Object.entries(value).forEach(([uid, item]) => {
                                const level = Array.isArray(item) ? item[0] : (item.level || 0);
                                const ts = Array.isArray(item) ? item[1] : (item.timestamp || 0);
                                converted[uid] = [level, ts];
                            });
                            localStorage.setItem(key, JSON.stringify(converted));
                         } else {
                            const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                            localStorage.setItem(key, stringValue);
                         }
                    }
                });

                if (legacyData.timestamp) {
                    localStorage.setItem("sync_local_update_timestamp", legacyData.timestamp.toString());
                }

                // 2. Force push the newly unpacked data into the new multi-file structure
                logger.info("Legacy", "Pushing migrated data to new format...");
                await onForcePushRequired();

                // 3. Delete the legacy file
                logger.info("Legacy", "Deleting legacy sync.json...");
                await GithubSync.deleteFile("sync.json", legacyRes.sha, "Remove legacy sync.json after migration");
                logger.info("Legacy", "Migration complete!");
                this._showMigrationToast("Migration completed successfully!", true);
            }
        } catch (e) {
            // Ignore if file doesn't exist or other network error during this check
            logger.info("Legacy", "No legacy sync.json found on cloud or failed to check.");
        }
    }
};