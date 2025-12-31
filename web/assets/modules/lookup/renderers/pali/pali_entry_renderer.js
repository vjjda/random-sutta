// Path: web/assets/modules/lookup/renderers/pali/pali_entry_renderer.js

export const PaliEntryRenderer = {
    render(data, gram, examples, getAbbr, getLabel, headword, isOpen) {
        // Read directly from flattened object
        const pos = data.pos || '';
        const meaning = data.meaning || '';
        const plusCase = data.plus_case || '';
        const meaningLit = data.meaning_lit || '';
        const construction = data.construction || '';
        const degree = data.degree || '';
        
        // Inflection Map (Grammatical Context) - Line 0 (Above Lemma)
        let line0 = '';
        if (data.inflection_map) {
            try {
                const mapData = typeof data.inflection_map === 'string' 
                    ? JSON.parse(data.inflection_map) 
                    : data.inflection_map;
                    
                if (Array.isArray(mapData) && mapData.length > 0) {
                    line0 = `<div class="dpd-inflection-info">${mapData.join(' | ')}</div>`;
                }
            } catch (e) { }
        }
        
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
            // Replace newlines with a visual separator for inline display
            const cleanConstr = construction.replace(/\n/g, ' | ');
            line2 = `<div class="dpd-summary-line-2"><span class="dpd-construction">[${cleanConstr}]</span></div>`;
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
                        ${line0}
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