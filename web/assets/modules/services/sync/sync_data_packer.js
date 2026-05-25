// Path: web/assets/modules/services/sync/sync_data_packer.js

export const FILES = {
    SETTINGS: "sync/settings.json",
    BOOKMARKS: "sync/bookmarks.json",
    HISTORY_ACTIVE: "sync/history_active.json",
    HISTORY_MASTERED: "sync/history_mastered.json"
};

export const SyncDataPacker = {
    // Keys mapping. Prefix -> Group name
    // e.g. "tts_" -> "tts" group in settings.json
    SETTING_PREFIXES: {
        "tts_": "tts",
        "display_": "display",
        "theme_": "theme"
    },

    // A fallback list of specific legacy keys if they don't follow prefixes strictly
    KNOWN_KEYS: ["tts_auto_next", "tts_playback_mode", "tts_active_engine", "tts_rate", "tts_pitch", "tts_voice_uri"],

    // Keys that might match the prefix but are purely local caches or ephemeral state
    IGNORED_KEYS: [
        "tts_gcloud_voices_list_v4", 
        "tts_gcloud_voices_ts_v4",
        "tts_gcloud_voices_list_v3",
        "tts_gcloud_voices_ts_v3"
    ],

    packData() {
        const settings = {};
        
        // Find all localStorage items matching our prefixes
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || this.IGNORED_KEYS.includes(key)) continue;
            
            for (const [prefix, groupName] of Object.entries(this.SETTING_PREFIXES)) {
                if (key.startsWith(prefix) || this.KNOWN_KEYS.includes(key)) {
                    // Initialize group
                    if (!settings[groupName]) {
                        settings[groupName] = {};
                    }
                    
                    const value = localStorage.getItem(key);
                    try {
                        settings[groupName][key.replace(prefix, '')] = JSON.parse(value);
                    } catch {
                        settings[groupName][key.replace(prefix, '')] = value;
                    }
                    break;
                }
            }
        }

        const bookmarks = JSON.parse(localStorage.getItem("sutta_bookmarks") || "{}");
        const history = JSON.parse(localStorage.getItem("sutta_history") || "{}");

        const history_active = {};
        const history_mastered = {};

        Object.entries(history).forEach(([uid, val]) => {
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

        // Unpack Grouped Settings
        if (cloudDataMap[FILES.SETTINGS]) {
            Object.entries(cloudDataMap[FILES.SETTINGS]).forEach(([groupName, groupData]) => {
                // Find prefix for this group
                let prefix = groupName + "_";
                for (const [p, g] of Object.entries(this.SETTING_PREFIXES)) {
                    if (g === groupName) prefix = p;
                }

                Object.entries(groupData).forEach(([shortKey, value]) => {
                    const fullKey = prefix + shortKey;
                    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                    localStorage.setItem(fullKey, stringValue);
                });
            });
        }

        if (cloudDataMap[FILES.BOOKMARKS]) {
            localStorage.setItem("sutta_bookmarks", JSON.stringify(cloudDataMap[FILES.BOOKMARKS]));
        }

        // Merge active and mastered history locally
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
    }
};
