// Path: web/assets/modules/data/repository/index_store.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("IndexStore");
let indexData = null;
let initPromise = null; // [NEW] Singleton Promise

export const IndexStore = {
    async init() {
        if (indexData) return;
        if (initPromise) return initPromise; // Return existing promise if loading

        initPromise = (async () => {
            // 1. Check Offline Global
            if (window.__DB_INDEX__) {
                indexData = window.__DB_INDEX__;
                logger.info("Init", "Loaded Index from Global (Offline Mode)");
                return;
            }

            // 2. Online Fetch
            try {
                const resp = await fetch('assets/db/uid_index.json');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                indexData = await resp.json();
                logger.info("Init", "Loaded Index from Network");
            } catch (e) {
                logger.error("Init", "Failed to load uid_index.json", e);
                // Reset promise on error to allow retry
                initPromise = null;
            }
        })();

        return initPromise;
    },

    get(uid) {
        return indexData ? indexData[uid] : null;
    },
    
    getAll() {
        return indexData;
    }
};