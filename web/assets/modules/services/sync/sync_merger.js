// Path: web/assets/modules/services/sync/sync_merger.js
import { SyncDataPacker, FILES } from "services/sync/sync_data_packer.js";
import { getLogger } from "utils/logger.js";

const logger = getLogger("SyncMerger");

export const SyncMerger = {
    /**
     * Takes cloud map and local map, returns merged map.
     */
    smartMerge(cloudDataMap, localDataMap) {
        const mergedMap = {};

        // Merge Settings (Local wins if conflict)
        // Group merging: merge each group inside settings.
        const mergedSettings = {};
        const cloudSettings = cloudDataMap[FILES.SETTINGS] || {};
        const localSettings = localDataMap[FILES.SETTINGS] || {};
        
        // Merge top-level group keys
        const allSettingGroups = new Set([...Object.keys(cloudSettings), ...Object.keys(localSettings)]);
        allSettingGroups.forEach(group => {
            mergedSettings[group] = { ...(cloudSettings[group] || {}), ...(localSettings[group] || {}) };
        });
        mergedMap[FILES.SETTINGS] = mergedSettings;

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

        logger.debug("SmartMerge", "Data successfully merged in-memory");
        return mergedMap;
    }
};
