// Path: web/assets/modules/lookup/dict_provider.js
import { PaliDPD } from './dictionaries/pali_dpd.js';
import { AppConfig } from 'core/app_config.js';

// Registry of available dictionary adapters
const REGISTRY = {
    'pali_dpd': PaliDPD
};

// Store active dictionary IDs and their configs
let activeDicts = [];
let dictConfigs = {}; // ID -> Config

export const DictProvider = {
    async init() {
        const dictConfig = AppConfig.LOOKUP.DICTIONARIES || {};
        const promises = [];
        activeDicts = []; 
        dictConfigs = {}; // Reset

        for (const [id, config] of Object.entries(dictConfig)) {
            // Check if adapter exists and is enabled
            if (REGISTRY[id] && config.enabled) {
                activeDicts.push(id);
                dictConfigs[id] = config; // Store config for runtime checks
                promises.push(REGISTRY[id].init(config));
            }
        }

        if (promises.length === 0) return false;

        const results = await Promise.all(promises);
        return results.every(r => r === true);
    },

    async search(term, contextElement = null) {
        // Search active dicts that match the context
        const results = [];
        
        for (const id of activeDicts) {
            // Context Check logic
            const config = dictConfigs[id];
            if (config && config.triggerSelectors && config.triggerSelectors.length > 0) {
                if (!contextElement) continue; // No context provided, but dict requires it
                
                // Check if element matches any selector (closest ancestor)
                const isMatch = config.triggerSelectors.some(sel => contextElement.closest(sel));
                if (!isMatch) continue; // Skip this dict
            }

            const dict = REGISTRY[id];
            const res = await dict.search(term);
            if (res && res.length > 0) {
                results.push(...res);
            }
        }
        return results;
    }
};
