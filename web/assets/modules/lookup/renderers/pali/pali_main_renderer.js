// Path: web/assets/modules/lookup/renderers/pali/pali_main_renderer.js

import { PaliDeconRenderer } from './pali_decon_renderer.js';
import { PaliEntryRenderer } from './pali_entry_renderer.js';
import { PaliGrammarRenderer } from './pali_grammar_renderer.js';
import { PaliRootRenderer } from './pali_root_renderer.js';

export const PaliMainRenderer = {
    renderList(dataList, searchTerm) {
        if (!dataList || !Array.isArray(dataList) || dataList.length === 0) {
            return { dictHtml: "", noteHtml: "" };
        }
        
        let dictHtml = '<div class="dpd-result-list">';
        let matchedGrammarNote = null;
        let keyMapRef = null;

        // 1. Separate Grammar Note (Type -2) from Content
        const grammarItem = dataList.find(d => d.is_grammar === true);
        
        // Exact Match Logic for Grammar Note Activation
        // Note: SQL View already enforces 'key = term' for Type -2. 
        // So if grammarItem exists, it is the correct one.
        if (grammarItem) {
            matchedGrammarNote = grammarItem.meaning;
            keyMapRef = grammarItem.keyMap;
        }

        // 2. Render Content Items (Exclude Grammar Item)
        dataList.forEach((data) => {
            if (data.is_grammar) return; // Skip Grammar Item

            // Render entry
            dictHtml += this.render(data, false);
        });
        
        dictHtml += '</div>';

        // Prepare Grammar Note HTML separately
        let noteHtml = "";
        if (matchedGrammarNote) {
            const getAbbr = (fullKey) => keyMapRef && keyMapRef.fullToAbbr && keyMapRef.fullToAbbr[fullKey] 
                ? keyMapRef.fullToAbbr[fullKey] 
                : fullKey;
            
            const gnArr = this._parse(matchedGrammarNote);
            
            if (gnArr && Array.isArray(gnArr) && gnArr.length > 0) {
                 noteHtml = PaliGrammarRenderer.renderNotes(gnArr);
            }
        }

        return { dictHtml, noteHtml };
    },

    render(data, isOpen = false) {
        if (!data) return "";
        const { lookup_type, lookup_key, entry_grammar, entry_example, keyMap } = data;
        
        // Helper: Data Lookup (Full -> Abbr)
        const getAbbr = (fullKey) => keyMap && keyMap.fullToAbbr && keyMap.fullToAbbr[fullKey] 
            ? keyMap.fullToAbbr[fullKey] 
            : fullKey;

        // Helper: Label Display (Abbr -> Full)
        const getLabel = (abbrKey) => keyMap && keyMap.abbrToFull && keyMap.abbrToFull[abbrKey]
            ? keyMap.abbrToFull[abbrKey]
            : abbrKey;
        
        let html = '<div class="dpd-result">';
        
        // 1. MAIN CONTENT based on TYPE
        
        if (lookup_type === -1 || (data.is_deconstruction === true)) {
            // Deconstruction: components are now in 'meaning' field
            html += PaliDeconRenderer.render(lookup_key, data.meaning);
            
        } else if (lookup_type === 1) {
            // Entry: Pass Flattened Data Object
            const gramObj = this._parse(entry_grammar);
            const exArr = this._parse(entry_example);
            
            html += PaliEntryRenderer.render(data, gramObj, exArr, getAbbr, getLabel, data.headword, isOpen);
            
        } else if (lookup_type === 0) {
            // Root
            html += PaliRootRenderer.render(data, getLabel);
        }
        
        html += '</div>';
        return html;
    },

    _parse(str) {
        if (!str) return null;
        // Safety: If it's already an object/array, return it directly.
        if (typeof str === 'object') return str;
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn("JSON Parse Error", e);
            return null;
        }
    }
};