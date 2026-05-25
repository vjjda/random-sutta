// Path: web/assets/modules/services/sync/sync_orchestrator.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";
import { GithubSync } from "services/sync/github_sync.js";
import { SyncUnificationUI } from "ui/managers/sync_unification_ui.js";
import { SyncMigration } from "services/sync/sync_migration.js";
import { SyncDataPacker, FILES } from "services/sync/sync_data_packer.js";
import { SyncMerger } from "services/sync/sync_merger.js";

const logger = getLogger("SyncOrchestrator");

export const SyncOrchestrator = {
    DEBOUNCE_MS: 30 * 60 * 1000, // 30 minutes debounce
    HEARTBEAT_MS: 30 * 60 * 1000, // 30 minutes heartbeat
    debounceTimer: null,
    isSyncing: false,

    init() {
        GithubAuthManager.init();
        
        if (!localStorage.getItem("sync_local_update_timestamp")) {
            localStorage.setItem("sync_local_update_timestamp", "0");
        }

        window.addEventListener("github-auth-success", () => this.autoSync());

        window.addEventListener("online", () => {
            logger.info("Network", "Back online. Checking sync...");
            if (GithubAuthManager.isAuthenticated()) this.autoSync();
        });

        window.addEventListener("local-data-changed", () => {
            localStorage.setItem("sync_local_update_timestamp", Date.now().toString());
            if (GithubAuthManager.isAuthenticated()) this.scheduleAutoPush();
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
            // Let Migration module handle legacy stuff, pass forcePush callback
            await SyncMigration.checkAndCleanLegacy(() => this.forcePush(), SyncDataPacker.KNOWN_KEYS);

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
                        const localDataMap = SyncDataPacker.packData();
                        SyncUnificationUI.show(localDataMap, cloudDataMap, async (choice) => {
                            this.isSyncing = true;
                            if (choice === 'merge') {
                                await this.smartMerge(cloudDataMap, cloudShas);
                            } else if (choice === 'cloud') {
                                SyncDataPacker.unpackAndApply(cloudDataMap);
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
                        SyncDataPacker.unpackAndApply(cloudDataMap);
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
        const localDataMap = SyncDataPacker.packData();
        const filesToUpload = [];

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

    async smartMerge(cloudDataMap, cloudShas) {
        const localDataMap = SyncDataPacker.packData();
        const mergedMap = SyncMerger.smartMerge(cloudDataMap, localDataMap);

        // Apply locally
        const mergeTimestamp = Date.now();
        SyncDataPacker.unpackAndApply(mergedMap);
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
        const localDataMap = SyncDataPacker.packData();
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
            SyncDataPacker.unpackAndApply(cloudDataMap);
            this._saveShas(cloudShas);
            localStorage.setItem("sync_last_success_timestamp", Date.now().toString());
            logger.info("ForcePull", "Done");
        } else {
            logger.warn("ForcePull", "No cloud data to pull");
        }
    }
};
