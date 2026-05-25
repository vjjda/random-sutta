// Path: web/assets/modules/services/sync/sync_orchestrator.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";
import { GithubSync } from "services/sync/github_sync.js";
import { SyncUnificationUI } from "ui/managers/sync_unification_ui.js";

const logger = getLogger("SyncOrchestrator");

const FILES = {
    SETTINGS: "sync/settings.json",
    BOOKMARKS: "sync/bookmarks.json",
    HISTORY_ACTIVE: "sync/history_active.json",
    HISTORY_MASTERED: "sync/history_mastered.json"
};

export const SyncOrchestrator = {
    SETTING_KEYS: ["tts_auto_next", "tts_playback_mode", "tts_active_engine", "tts_rate", "tts_pitch", "tts_voice_uri"],
    DEBOUNCE_MS: 30 * 60 * 1000, // 30 minutes debounce
    HEARTBEAT_MS: 30 * 60 * 1000, // 30 minutes heartbeat
    debounceTimer: null,
    isSyncing: false,

    init() {
        GithubAuthManager.init();
        
        if (!localStorage.getItem("sync_local_update_timestamp")) {
            localStorage.setItem("sync_local_update_timestamp", "0");
        }

        window.addEventListener("github-auth-success", () => {
            this.autoSync();
        });

        window.addEventListener("online", () => {
            logger.info("Network", "Back online. Checking sync...");
            if (GithubAuthManager.isAuthenticated()) {
                this.autoSync();
            }
        });

        window.addEventListener("local-data-changed", () => {
            localStorage.setItem("sync_local_update_timestamp", Date.now().toString());
            if (GithubAuthManager.isAuthenticated()) {
                this.scheduleAutoPush();
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && GithubAuthManager.isAuthenticated()) {
                logger.info("Focus", "App became visible, checking for updates...");
                this.autoSync();
            }
        });

        setInterval(() => {
            if (GithubAuthManager.isAuthenticated() && !this.isSyncing) {
                this.autoSync();
            }
        }, this.HEARTBEAT_MS);

        if (GithubAuthManager.isAuthenticated()) {
            this.autoSync();
        }
    },

    _showMigrationToast(message, isCompleted = false) {
        let toast = document.getElementById("sync-migration-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "sync-migration-toast";
            Object.assign(toast.style, {
                position: "fixed",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "var(--bg-card, #fff)",
                color: "var(--text-primary, #000)",
                padding: "16px 24px",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                zIndex: "9999",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontWeight: "500",
                fontSize: "0.95rem",
                transition: "opacity 0.3s ease, bottom 0.3s ease"
            });
            document.body.appendChild(toast);
        }
        
        if (isCompleted) {
            toast.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color, #4CAF50)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${message}`;
            setTimeout(() => {
                toast.style.opacity = "0";
                toast.style.bottom = "10px";
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        } else {
            toast.innerHTML = `<div style="width: 20px; height: 20px; border: 3px solid var(--border-color, #eee); border-top: 3px solid var(--primary-color, #2196F3); border-radius: 50%; animation: sync-spin 1s linear infinite;"></div> ${message}`;
            
            if (!document.getElementById("sync-spinner-style")) {
                const style = document.createElement("style");
                style.id = "sync-spinner-style";
                style.innerHTML = "@keyframes sync-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
                document.head.appendChild(style);
            }
        }
    },

    async _checkAndCleanLegacy() {
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
                    if (this.SETTING_KEYS.includes(key) || key === "sutta_bookmarks" || key === "sutta_history") {
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
                await this.forcePush();

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
    },

    async autoSync() {
        if (this.isSyncing) return;

        if (!navigator.onLine) {
            logger.info("AutoSync", "Offline. Skipping sync.");
            return;
        }

        this.isSyncing = true;
        window.dispatchEvent(new CustomEvent("sync-start"));
        logger.info("AutoSync", "Starting auto-sync...");
        
        try {
            await this._checkAndCleanLegacy();

            const cloudDataMap = {};
            const cloudShas = {};
            let hasCloudData = false;

            for (const f of Object.values(FILES)) {
                const res = await GithubSync.downloadData(f);
                if (res) {
                    cloudDataMap[f] = res.data;
                    cloudShas[f] = res.sha;
                    hasCloudData = true;
                }
            }

            const localUpdateTimestamp = parseInt(localStorage.getItem("sync_local_update_timestamp") || "0", 10);
            const lastSyncTimestamp = parseInt(localStorage.getItem("sync_last_success_timestamp") || "0", 10);

            if (hasCloudData) {
                let cloudHasChanged = false;
                for (const f of Object.values(FILES)) {
                    const localSha = localStorage.getItem(`sync_sha_${f}`);
                    if (cloudShas[f] !== localSha && cloudShas[f] !== undefined) {
                        cloudHasChanged = true;
                    }
                }
                
                if (!cloudHasChanged) {
                    logger.info("AutoSync", "Cloud is up to date.");
                    if (localUpdateTimestamp > lastSyncTimestamp) {
                        logger.info("AutoSync", "Local changes detected, pushing to cloud.");
                        await this._doPush(this._getLocalShas());
                    }
                } else {
                    logger.info("AutoSync", "Cloud has changed.");
                    if (localUpdateTimestamp > lastSyncTimestamp) {
                        logger.info("AutoSync", "Local has changed too. Triggering Unification UI.");
                        this.isSyncing = false; // Release lock for UI interaction
                        const localDataMap = this.packData();
                        SyncUnificationUI.show(localDataMap, cloudDataMap, async (choice) => {
                            this.isSyncing = true;
                            if (choice === 'merge') {
                                await this.smartMerge(cloudDataMap, cloudShas);
                            } else if (choice === 'cloud') {
                                this.unpackAndApply(cloudDataMap);
                                this._saveShas(cloudShas);
                                localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
                            } else if (choice === 'local') {
                                await this._doPush(this._getLocalShas());
                            } else if (choice === 'cancel') {
                                logger.info("AutoSync", "User ignored unification choice.");
                            }
                            window.dispatchEvent(new CustomEvent("sync-end"));
                        });
                        return; // Wait for callback
                    } else {
                        logger.info("AutoSync", "No local changes. Pulling from cloud.");
                        this.unpackAndApply(cloudDataMap);
                        this._saveShas(cloudShas);
                        localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
                    }
                }
            } else {
                logger.info("AutoSync", "No cloud data found. Preparing first push.");
                await this.forcePush();
            }
            window.dispatchEvent(new CustomEvent("sync-end"));
        } catch (e) {
            logger.error("AutoSync", e);
            window.dispatchEvent(new CustomEvent("sync-error"));
        } finally {
            this.isSyncing = false;
        }
    },

    scheduleAutoPush() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.autoPush();
        }, this.DEBOUNCE_MS);
    },

    async autoPush() {
        if (this.isSyncing) return;

        if (!navigator.onLine) {
            logger.info("AutoPush", "Offline. Skipping push.");
            return;
        }

        this.isSyncing = true;
        window.dispatchEvent(new CustomEvent("sync-start"));
        try {
            await this._doPush(this._getLocalShas());
            window.dispatchEvent(new CustomEvent("sync-end"));
        } catch (e) {
            logger.error("AutoPush", e);
            if (e.message.includes("409")) {
                 logger.warn("AutoPush", "Conflict detected during push. Triggering autoSync...");
                 this.isSyncing = false;
                 await this.autoSync();
                 return;
            }
            window.dispatchEvent(new CustomEvent("sync-error"));
        } finally {
            this.isSyncing = false;
        }
    },

    _getLocalShas() {
        const shas = {};
        for (const f of Object.values(FILES)) {
            const val = localStorage.getItem(`sync_sha_${f}`);
            if (val) shas[f] = val;
        }
        return shas;
    },

    _saveShas(shas) {
        for (const [f, sha] of Object.entries(shas)) {
            if (sha) {
                localStorage.setItem(`sync_sha_${f}`, sha);
            }
        }
    },

    async _doPush(currentShas) {
        const localDataMap = this.packData();
        const filesToUpload = [];

        // Upload all parts that are necessary. With Data API we can just override tree.
        for (const [f, content] of Object.entries(localDataMap)) {
            filesToUpload.push({
                path: f,
                content: content
            });
        }

        if (filesToUpload.length > 0) {
            const newShas = await GithubSync.uploadMultipleFiles(filesToUpload, "Sync: Auto push updates");
            this._saveShas(newShas);
            localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
            logger.info("_doPush", "Success");
        }
    },

    packData() {
        const settings = {};
        this.SETTING_KEYS.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                try { settings[key] = JSON.parse(value); } catch { settings[key] = value; }
            }
        });

        const bookmarks = JSON.parse(localStorage.getItem("sutta_bookmarks") || "{}");
        const history = JSON.parse(localStorage.getItem("sutta_history") || "{}");

        const history_active = {};
        const history_mastered = {};

        Object.entries(history).forEach(([uid, val]) => {
            // New strict format is Array: [level, timestamp]
            const level = Array.isArray(val) ? val[0] : 0;
            if (level >= 5) {
                history_mastered[uid] = val;
            } else {
                history_active[uid] = val;
            }
        });

        return {
            [FILES.SETTINGS]: settings,
            [FILES.BOOKMARKS]: bookmarks,
            [FILES.HISTORY_ACTIVE]: history_active,
            [FILES.HISTORY_MASTERED]: history_mastered
        };
    },

    unpackAndApply(cloudDataMap) {
        if (!cloudDataMap) return;

        if (cloudDataMap[FILES.SETTINGS]) {
            Object.entries(cloudDataMap[FILES.SETTINGS]).forEach(([key, value]) => {
                const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                localStorage.setItem(key, stringValue);
            });
        }

        if (cloudDataMap[FILES.BOOKMARKS]) {
            localStorage.setItem("sutta_bookmarks", JSON.stringify(cloudDataMap[FILES.BOOKMARKS]));
        }

        // Merge active and mastered history
        const mergedHistory = {};
        if (cloudDataMap[FILES.HISTORY_MASTERED]) {
            Object.assign(mergedHistory, cloudDataMap[FILES.HISTORY_MASTERED]);
        }
        if (cloudDataMap[FILES.HISTORY_ACTIVE]) {
            Object.assign(mergedHistory, cloudDataMap[FILES.HISTORY_ACTIVE]);
        }
        if (Object.keys(mergedHistory).length > 0) {
            localStorage.setItem("sutta_history", JSON.stringify(mergedHistory));
        }

        window.dispatchEvent(new CustomEvent("sync-data-applied"));
    },

    async smartMerge(cloudDataMap, cloudShas) {
        const localDataMap = this.packData();
        const mergedMap = {};

        // Merge Settings (Local wins if conflict)
        mergedMap[FILES.SETTINGS] = { ...(cloudDataMap[FILES.SETTINGS] || {}), ...localDataMap[FILES.SETTINGS] };

        // Merge Bookmarks
        const localBookmarks = localDataMap[FILES.BOOKMARKS] || {};
        const cloudBookmarks = cloudDataMap[FILES.BOOKMARKS] || {};
        const mergedBookmarks = { ...localBookmarks };
        
        Object.keys(cloudBookmarks).forEach(uid => {
            const cloudVal = cloudBookmarks[uid];
            const cloudTs = Math.abs(cloudVal);
            const localVal = mergedBookmarks[uid] || 0;
            const localTs = Math.abs(localVal);
            
            if (!mergedBookmarks[uid] || cloudTs > localTs) {
                mergedBookmarks[uid] = cloudVal;
            }
        });
        mergedMap[FILES.BOOKMARKS] = mergedBookmarks;

        // Merge History
        const localHistory = { ...(localDataMap[FILES.HISTORY_ACTIVE] || {}), ...(localDataMap[FILES.HISTORY_MASTERED] || {}) };
        const cloudHistory = { ...(cloudDataMap[FILES.HISTORY_ACTIVE] || {}), ...(cloudDataMap[FILES.HISTORY_MASTERED] || {}) };
        const mergedHistory = { ...localHistory };

        Object.keys(cloudHistory).forEach(uid => {
            const cloudItem = cloudHistory[uid];
            const cloudLvl = Array.isArray(cloudItem) ? cloudItem[0] : 0;
            const cloudTs = Array.isArray(cloudItem) ? cloudItem[1] : 0;

            const localItem = mergedHistory[uid];
            const localTs = Array.isArray(localItem) ? localItem[1] : -1;

            if (!localItem || cloudTs > localTs) {
                mergedHistory[uid] = [cloudLvl, cloudTs];
            }
        });

        // Split merged history back into active and mastered
        mergedMap[FILES.HISTORY_ACTIVE] = {};
        mergedMap[FILES.HISTORY_MASTERED] = {};
        Object.entries(mergedHistory).forEach(([uid, val]) => {
            if (val[0] >= 5) {
                mergedMap[FILES.HISTORY_MASTERED][uid] = val;
            } else {
                mergedMap[FILES.HISTORY_ACTIVE][uid] = val;
            }
        });

        // Apply locally
        const mergeTimestamp = Date.now();
        this.unpackAndApply(mergedMap);
        localStorage.setItem("sync_local_update_timestamp", mergeTimestamp.toString());
        
        // Push to cloud
        const filesToUpload = [];
        for (const [f, content] of Object.entries(mergedMap)) {
            filesToUpload.push({ path: f, content: content });
        }
        const newShas = await GithubSync.uploadMultipleFiles(filesToUpload, "Sync: Smart Merge");
        this._saveShas(newShas);
        localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
        logger.info("SmartMerge", "Done and pushed to cloud.");
    },

    async forcePush() {
        logger.info("ForcePush", "Overwriting cloud with local data...");
        const localDataMap = this.packData();
        const filesToUpload = [];
        for (const [f, content] of Object.entries(localDataMap)) {
            filesToUpload.push({ path: f, content: content });
        }
        const newShas = await GithubSync.uploadMultipleFiles(filesToUpload, "Sync: Force Push");
        this._saveShas(newShas);
        localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
        logger.info("ForcePush", "Done");
    },

    async forcePull() {
        logger.info("ForcePull", "Overwriting local with cloud data...");
        const cloudDataMap = {};
        const cloudShas = {};
        let hasCloudData = false;

        for (const f of Object.values(FILES)) {
            const res = await GithubSync.downloadData(f);
            if (res) {
                cloudDataMap[f] = res.data;
                cloudShas[f] = res.sha;
                hasCloudData = true;
            }
        }

        if (hasCloudData) {
            this.unpackAndApply(cloudDataMap);
            this._saveShas(cloudShas);
            localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
            logger.info("ForcePull", "Done");
        } else {
            logger.warn("ForcePull", "No cloud data to pull");
        }
    }
};
