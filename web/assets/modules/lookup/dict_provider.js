// Path: web/assets/modules/lookup/dict_provider.js
import { PaliDPD } from './dictionaries/pali_dpd.js';
import { AppConfig } from 'core/app_config.js';

// Registry of available dictionary adapters
const REGISTRY = {
    'pali_dpd': PaliDPD
};

// Store active dictionary IDs after init
let activeDicts = [];

export const DictProvider = {
    async init() {
        const dictConfig = AppConfig.LOOKUP.DICTIONARIES || {};
        const promises = [];
        activeDicts = []; // Reset

        for (const [id, config] of Object.entries(dictConfig)) {
            // Check if adapter exists and is enabled
            if (REGISTRY[id] && config.enabled) {
                activeDicts.push(id);
                promises.push(REGISTRY[id].init(config));
            }
        }

        if (promises.length === 0) return false;

        const results = await Promise.all(promises);
        return results.every(r => r === true);
    },

    async search(term) {
        // Search all active dicts and merge results
        const results = [];
        for (const id of activeDicts) {
            const dict = REGISTRY[id];
            const res = await dict.search(term);
            if (res && res.length > 0) {
                results.push(...res);
            }
        }
        return results;
    }
};
