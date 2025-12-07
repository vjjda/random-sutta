// Path: web/assets/modules/data/offline_syncer.js
import { getLogger } from '../utils/logger.js';
import { IODriver } from './io_driver.js';

const logger = getLogger("OfflineSyncer");

export const OfflineSyncer = {
    async downloadAll(uidIndex, onProgress) {
        if (!uidIndex || !uidIndex.locator) return;

        const allLocators = new Set(Object.values(uidIndex.locator));
        allLocators.add("structure/super_struct");

        const total = allLocators.size;
        let current = 0;
        const items = Array.from(allLocators);
        const batchSize = 5; // Tải song song 5 file một lúc

        logger.info("downloadAll", `Start downloading ${total} chunks...`);

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            
            await Promise.all(batch.map(loc => {
                const path = `assets/db/${loc}.json`;
                return IODriver.preloadUrl(path);
            }));

            current += batch.length;
            if (onProgress) onProgress(Math.min(current, total), total);
        }
        
        logger.info("downloadAll", "Completed.");
    }
};