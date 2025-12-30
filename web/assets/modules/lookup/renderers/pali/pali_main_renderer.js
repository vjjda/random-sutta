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

        dataList.forEach((data) => {
            // Check for grammar note match (Exact Match Only)
            if (searchTerm && data.lookup_key === searchTerm && data.grammar_note && !matchedGrammarNote) {
                matchedGrammarNote = data.grammar_note;
                keyMapRef = data.keyMap; 
            }
            
            // Render entry
            dictHtml += this.render(data, false, true);
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

    render(data, isOpen = false, skipGrammar = false) {
        if (!data) return "";
        const { lookup_type, lookup_key, definition, grammar_note, entry_grammar, entry_example, keyMap } = data;
        
        // Helper: Data Lookup (Full -> Abbr)
        const getAbbr = (fullKey) => keyMap && keyMap.fullToAbbr && keyMap.fullToAbbr[fullKey] 
            ? keyMap.fullToAbbr[fullKey] 
            : fullKey;

        // Helper: Label Display (Abbr -> Full)
        const getLabel = (abbrKey) => keyMap && keyMap.abbrToFull && keyMap.abbrToFull[abbrKey]
            ? keyMap.abbrToFull[abbrKey]
            : abbrKey;
        
        let html = '<div class="dpd-result">';
        
        // 1. MAIN CONTENT based on TYPE (UPDATED SCHEMA)
        // Type -1: Deconstruction (Frontend Special)
        // Type 0 : Root (DB Schema v2)
        // Type 1 : Entry (DB Schema v2)
        
        if (lookup_type === -1 || (data.is_deconstruction === true)) {
            // Deconstruction
            html += PaliDeconRenderer.render(lookup_key, definition);
            
        } else if (lookup_type === 1) {
            // Entry
            const defObj = (typeof definition === 'string') ? this._parse(definition) : definition;
            const gramObj = this._parse(entry_grammar);
            const exArr = this._parse(entry_example);
            
            if (defObj) {
                html += PaliEntryRenderer.render(defObj, gramObj, exArr, getAbbr, getLabel, data.headword, isOpen);
            }
            
        } else if (lookup_type === 0) {
            // Root (Refactored: Columns are in data object, not JSON definition)
            html += PaliRootRenderer.render(data, getLabel);
        }
        
        // 2. GRAMMAR NOTES (Common) - Only if NOT skipped
        if (!skipGrammar) {
            const gnArr = this._parse(grammar_note);
            if (gnArr && Array.isArray(gnArr) && gnArr.length > 0) {
                 html += PaliGrammarRenderer.renderNotes(gnArr);
            }
        }
        
        html += '</div>';
        return html;
    },

    _parse(str) {
        if (!str) return null;
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn("JSON Parse Error", e);
            return null;
        }
    }
};