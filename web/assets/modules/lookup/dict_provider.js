// Path: web/assets/modules/lookup/dict_provider.js
import { PaliDPD } from './dictionaries/pali_dpd.js';

// Registry of available dictionaries
const REGISTRY = {
    'pali_dpd': PaliDPD
};

// Currently active dictionaries (in order)
// TODO: Load this from user settings in the future
let activeDicts = ['pali_dpd'];

export const DictProvider = {
    async init() {
        // Initialize all active dictionaries
        const promises = activeDicts.map(id => REGISTRY[id].init());
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
