// Path: web/assets/modules/pali_lookup/utils/pali_renderer.js

export const PaliRenderer = {
    render(data) {
        if (!data) return "";
        const { lookup_type, lookup_key, definition, grammar_note, entry_grammar, entry_example, jsonKeys } = data;
        
        // Helper to expand keys
        const expand = (key) => jsonKeys && jsonKeys[key] ? jsonKeys[key] : key;
        
        let html = '<div class="dpd-result">';
        
        // 1. MAIN CONTENT based on TYPE
        if (lookup_type === 0) {
            // Deconstruction
            // For type 0, 'definition' column holds 'components' (raw text)
            html += this._renderDeconstruction(lookup_key, definition);
            
        } else if (lookup_type === 1) {
            // Entry
            const defObj = this._parse(definition);
            const gramObj = this._parse(entry_grammar);
            const exArr = this._parse(entry_example);
            
            if (defObj) {
                html += this._renderEntry(defObj, gramObj, exArr, expand, data.headword);
            }
            
        } else if (lookup_type === 2) {
            // Root
            const rootObj = this._parse(definition);
            if (rootObj) {
                html += this._renderRoot(rootObj, expand);
            }
        }
        
        // 2. GRAMMAR NOTES (Common)
        const gnArr = this._parse(grammar_note);
        if (gnArr && Array.isArray(gnArr) && gnArr.length > 0) {
             html += this._renderGrammarNotes(gnArr, expand);
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

    _renderEntry(def, gram, examples, expand, headword) {
        // Entry Summary
        let html = `<div class="dpd-entry">`;
        
        // Header / Summary
        // Mimic: <b>headword</b>: pos. (plus_case) meaning [construction] degree
        const pos = def[expand('pos')] || '';
        const meaning = def[expand('meaning')] || '';
        const plusCase = def[expand('plus_case')] || '';
        const construction = def[expand('construction')] || '';
        const degree = def[expand('degree')] || '';
        
        let summary = `<span class="dpd-lemma">${headword}</span>: <span class="dpd-pos">${pos}</span>. `;
        if (plusCase) summary += `(${plusCase}) `;
        summary += `<span class="dpd-meaning">${meaning}</span>`;
        if (construction) summary += ` [${construction}]`;
        if (degree) summary += ` ${degree}`;
        
        html += `<div class="dpd-summary">${summary}</div>`;
        
        // Grammar Table
        if (gram) {
            html += `<table class="dpd-grammar-table">`;
            for (const [k, v] of Object.entries(gram)) {
                const label = expand(k);
                html += `<tr><td class="th">${label}</td><td>${v}</td></tr>`;
            }
            html += `</table>`;
        }
        
        // Examples
        if (examples && Array.isArray(examples)) {
            html += `<div class="dpd-examples"><p class="example-heading">Examples</p>`;
            examples.forEach(ex => {
                const source = ex[expand('source')] || '';
                const sutta = ex[expand('sutta')] || '';
                const text = ex[expand('text')] || '';
                html += `
                <div class="example-box">
                    <p class="example-text">${text}</p>
                    <p class="example-source">${source} ${sutta}</p>
                </div>`;
            });
            html += `</div>`;
        }
        
        html += `</div>`;
        return html;
    },

    _renderRoot(root, expand) {
        // Root content
        let html = `<table class="dpd-grammar-table">`;
        for (const [k, v] of Object.entries(root)) {
            html += `<tr><td class="th">${expand(k)}</td><td>${v}</td></tr>`;
        }
        html += `</table>`;
        return html;
    },

    _renderGrammarNotes(notes, expand) {
        // notes is array of objects { headword, pos, grammar }
        let html = `<div class="grammar-note-container">`;
        html += `<table class="grammar-note-table">`;
        html += `<thead><tr><th>pos</th><th colspan="2">grammar</th><th>word</th></tr></thead>`; // simplified cols
        html += `<tbody>`;
        
        notes.forEach(item => {
            const pos = item[expand('pos')] || '';
            const grammar = item[expand('grammar')] || '';
            const word = item[expand('headword')] || '';
            
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
