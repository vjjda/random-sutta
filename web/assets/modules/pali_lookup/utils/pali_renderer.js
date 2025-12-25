// Path: web/assets/modules/pali_lookup/utils/pali_renderer.js

export const PaliRenderer = {
    renderList(dataList, searchTerm) {
        if (!dataList || !Array.isArray(dataList) || dataList.length === 0) return "";
        
        let html = '<div class="dpd-result-list">';
        let matchedGrammarNote = null;
        let keyMapRef = null;

        dataList.forEach((data) => {
            // Check for grammar note match (Exact Match Only)
            // We use the first one found for the term
            if (searchTerm && data.lookup_key === searchTerm && data.grammar_note && !matchedGrammarNote) {
                matchedGrammarNote = data.grammar_note;
                keyMapRef = data.keyMap; // Need keyMap to render grammar note later
            }
            
            // Render entry, collapsed (isOpen=false), skip internal grammar note (skipGrammar=true)
            html += this.render(data, false, true);
        });
        
        html += '</div>';

        // Render the single Grammar Note at the bottom if found
        if (matchedGrammarNote) {
            const getAbbr = (fullKey) => keyMapRef && keyMapRef.fullToAbbr && keyMapRef.fullToAbbr[fullKey] 
                ? keyMapRef.fullToAbbr[fullKey] 
                : fullKey;
            
            const gnArr = this._parse(matchedGrammarNote);
            if (gnArr && Array.isArray(gnArr) && gnArr.length > 0) {
                 html += this._renderGrammarNotes(gnArr, getAbbr);
            }
        }

        return html;
    },

    render(data, isOpen = false, skipGrammar = false) {
        if (!data) return "";
        const { lookup_type, lookup_key, definition, grammar_note, entry_grammar, entry_example, keyMap } = data;
        
        // Helper: Data Lookup (Full -> Abbr)
        // e.g. "pos" -> "p" (used to find value in data object)
        const getAbbr = (fullKey) => keyMap && keyMap.fullToAbbr && keyMap.fullToAbbr[fullKey] 
            ? keyMap.fullToAbbr[fullKey] 
            : fullKey;

        // Helper: Label Display (Abbr -> Full)
        // e.g. "p" -> "Part of Speech" (used to display readable label)
        const getLabel = (abbrKey) => keyMap && keyMap.abbrToFull && keyMap.abbrToFull[abbrKey]
            ? keyMap.abbrToFull[abbrKey]
            : abbrKey;
        
        let html = '<div class="dpd-result">';
        
        // 1. MAIN CONTENT based on TYPE
        if (lookup_type === 0) {
            // Deconstruction
            html += this._renderDeconstruction(lookup_key, definition);
            
        } else if (lookup_type === 1) {
            // Entry
            const defObj = this._parse(definition);
            const gramObj = this._parse(entry_grammar);
            const exArr = this._parse(entry_example);
            
            if (defObj) {
                html += this._renderEntry(defObj, gramObj, exArr, getAbbr, getLabel, data.headword, isOpen);
            }
            
        } else if (lookup_type === 2) {
            // Root
            const rootObj = this._parse(definition);
            if (rootObj) {
                html += this._renderRoot(rootObj, getLabel);
            }
        }
        
        // 2. GRAMMAR NOTES (Common) - Only if NOT skipped
        if (!skipGrammar) {
            const gnArr = this._parse(grammar_note);
            if (gnArr && Array.isArray(gnArr) && gnArr.length > 0) {
                 html += this._renderGrammarNotes(gnArr, getAbbr);
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
    },

    _renderDeconstruction(word, components) {
        return `
        <div class="dpd-deconstruction">
            <p class="decon-key"><b>${word}</b></p>
            <p class="decon-val">${components ? components.replace(/\+/g, ' + ') : ''}</p>
        </div>`;
    },

    _renderEntry(def, gram, examples, getAbbr, getLabel, headword, isOpen) {
        // Use details/summary for the toggle
        const openAttr = isOpen ? 'open' : '';
        let html = `<details class="dpd-entry" ${openAttr}>`;
        
        // --- Header / Summary Construction ---
        const pos = def[getAbbr('pos')] || '';
        const meaning = def[getAbbr('meaning')] || '';
        const plusCase = def[getAbbr('plus_case')] || '';
        const construction = def[getAbbr('construction')] || '';
        const degree = def[getAbbr('degree')] || '';
        
        // Line 1: Lemma (Left) --- POS + Case (Right)
        let line1 = `
            <div class="dpd-summary-line-1">
                <span class="dpd-lemma">${headword}</span>
                <span class="dpd-pos-group">
                    <span class="dpd-pos">${pos}</span>
                    ${plusCase ? `<span class="dpd-plus-case">(${plusCase})</span>` : ''}
                </span>
            </div>`;

        // Line 2: Construction (Standalone, Low Profile)
        let line2 = '';
        if (construction) {
            line2 = `<div class="dpd-summary-line-2"><span class="dpd-construction">[${construction}]</span></div>`;
        }

        // Line 3: Meaning (Left) --- Degree (Right, Very Low Profile)
        let line3 = `
            <div class="dpd-summary-line-3">
                <span class="dpd-meaning">${meaning}</span>
                ${degree ? `<span class="dpd-degree">${degree}</span>` : ''}
            </div>`;
        
        // Add a visual indicator or "More" text if needed, though default marker exists.
        html += `<summary class="dpd-summary">
                    ${line1}
                    ${line2}
                    ${line3}
                 </summary>`;
        
        // The expanded content
        html += `<div class="dpd-details-content">`;

        // Grammar Table
        if (gram) {
            html += `<table class="dpd-grammar-table">`;
            for (const [k, v] of Object.entries(gram)) {
                // k is Abbreviation (e.g., 'p')
                // label is Full Key (e.g., 'Part of Speech')
                const label = getLabel(k); 
                html += `<tr><th>${label}</th><td>${v}</td></tr>`;
            }
            html += `</table>`;
        }
        
        // Examples
        if (examples && Array.isArray(examples)) {
            html += `<div class="dpd-examples"><p class="example-heading">Examples</p>`;
            examples.forEach(ex => {
                const source = ex[getAbbr('source')] || '';
                const sutta = ex[getAbbr('sutta')] || '';
                const text = ex[getAbbr('text')] || '';
                html += `
                <div class="example-box">
                    <p class="example-text">${text}</p>
                    <p class="example-source">${source} ${sutta}</p>
                </div>`;
            });
            html += `</div>`;
        }
        
        html += `</div>`; // End .dpd-details-content
        html += `</details>`;
        return html;
    },

    _renderRoot(root, getLabel) {
        let html = `<table class="dpd-grammar-table">`;
        for (const [k, v] of Object.entries(root)) {
            const label = getLabel(k);
            html += `<tr><th>${label}</th><td>${v}</td></tr>`;
        }
        html += `</table>`;
        return html;
    },

    _renderGrammarNotes(notes, getAbbr) {
        let html = `<div class="grammar-note-container">`;
        html += `<table class="grammar-note-table">`;
        html += `<thead><tr><th>pos</th><th colspan="2">grammar</th><th>word</th></tr></thead>`; 
        html += `<tbody>`;
        
        notes.forEach(item => {
            const pos = item[getAbbr('pos')] || '';
            const grammar = item[getAbbr('grammar')] || '';
            const word = item[getAbbr('headword')] || '';
            
            html += `<tr>
                <td class="col-pos">${pos}</td>
                <td class="col-grammar" colspan="2">${grammar}</td>
                <td class="col-word">${word}</td>
            </tr>`;
        });
        
        html += `</tbody></table></div>`;
        return html;
    }
};