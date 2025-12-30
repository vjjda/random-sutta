// Path: web/assets/modules/lookup/renderers/pali/pali_entry_renderer.js

export const PaliEntryRenderer = {
    render(def, gram, examples, getAbbr, getLabel, headword, isOpen) {
        const pos = def[getAbbr('pos')] || '';
        const meaning = def[getAbbr('meaning')] || '';
        const plusCase = def[getAbbr('plus_case')] || '';
        const meaningLit = def[getAbbr('meaning_lit')] || '';
        const construction = def[getAbbr('construction')] || '';
        const degree = def[getAbbr('degree')] || '';
        
        // Check if there is content to expand
        const hasDetails = (gram && Object.keys(gram).length > 0) || (examples && Array.isArray(examples) && examples.length > 0);
        
        // Determine tags and classes
        const tag = hasDetails ? 'details' : 'div';
        const summaryTag = hasDetails ? 'summary' : 'div';
        const classes = `dpd-entry ${hasDetails ? 'has-details' : 'no-details'}`;
        const openAttr = (hasDetails && isOpen) ? 'open' : '';

        let html = `<${tag} class="${classes}" ${openAttr}>`;
        
        // Line 1: Lemma (Left) --- POS + Case + Degree (Right)
        let line1 = `
            <div class="dpd-summary-line-1">
                <span class="dpd-lemma">${headword}</span>
                <span class="dpd-pos-group">
                    <span class="dpd-pos">${pos}</span>
                    ${plusCase ? `<span class="dpd-plus-case">(${plusCase})</span>` : ''}
                    ${degree ? `<span class="dpd-degree">${degree}</span>` : ''}
                </span>
            </div>`;

        // Line 2: Construction (Standalone, Low Profile)
        let line2 = '';
        if (construction) {
            line2 = `<div class="dpd-summary-line-2"><span class="dpd-construction">[${construction}]</span></div>`;
        }

        // Line 3: Meaning + Lit Meaning (Left)
        let line3 = `
            <div class="dpd-summary-line-3">
                <span class="dpd-meaning">${meaning}</span>
                ${meaningLit ? `<span class="dpd-meaning-lit">lit. ${meaningLit}</span>` : ''}
            </div>`;
        
        // Summary Header
        html += `<${summaryTag} class="dpd-summary">
                    <div class="dpd-summary-content">
                        ${line1}
                        ${line2}
                        ${line3}
                    </div>
                    ${hasDetails ? '<span class="dpd-detail-icon"></span>' : ''}
                 </${summaryTag}>`;
        
        // The expanded content (Only if details exist)
        if (hasDetails) {
            html += `<div class="dpd-details-content">`;

            // Grammar Table
            if (gram) {
                html += `<table class="dpd-grammar-table">`;
                for (const [k, v] of Object.entries(gram)) {
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
            
            html += `</div>`; // End content
        }
        
        html += `</${tag}>`;
        return html;
    }
};