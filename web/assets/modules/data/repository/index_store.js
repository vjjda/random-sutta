// Path: web/assets/modules/data/repository/index_store.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("IndexStore");
let indexData = null;

export const IndexStore = {
    async init() {
        if (indexData) return;

        // 1. Check Offline Global Inject (do Build System tạo ra)
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
        }
    },

    /**
     * Trả về vị trí [book_id, chunk_index] của một UID.
     */
    get(uid) {
        return indexData ? indexData[uid] : null;
    },
    
    /**
     * Trả về toàn bộ Index (dùng cho downloadAll).
     */
    getAll() {
        return indexData;
    }
};