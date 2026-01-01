// Path: web/assets/modules/lookup/renderers/pali/pali_entry_renderer.js

export const PaliEntryRenderer = {
    render(data, gram, examples, getAbbr, getLabel, headword, isOpen, isSimilar = false) {
        // Read directly from flattened object
        const pos = data.pos || '';
        const meaning = data.meaning || '';
        const plusCase = data.plus_case || '';
        const meaningLit = data.meaning_lit || '';
        const construction = data.construction || '';
        const degree = data.degree || '';
        
        // Parse Inflection Info & Group by Gender
        let inflectionHtmlContent = '';
        if (data.inflection_map) {
            try {
                const mapData = typeof data.inflection_map === 'string' 
                    ? JSON.parse(data.inflection_map) 
                    : data.inflection_map;
                    
                if (Array.isArray(mapData) && mapData.length > 0) {
                    // Grouping Configuration (Expanded based on DPD Docs)
                    const sortOrder = [
                        // Genders
                        'masc', 'nt', 'neut', 'fem', 
                        // Tenses & Moods
                        'pr', 'imp', 'opt', 'cond', 'fut', 'aor', 'imperf', 'perf',
                        // Verb Forms
                        'pp', 'ppr', 'fpp', 'grd', 'ptp', 'abs', 'ger', 'inf',
                        // Voice / Derivation
                        'pass', 'caus', 'denom',
                        // Parts of Speech
                        'adj', 'pron', 'card', 'ord', 'indecl', 'adv', 'prep'
                    ];

                    const getGroupKey = (item) => {
                        const parts = item.toLowerCase().split(' ');
                        const first = parts[0];
                        
                        // Handle Reflexive: group by 'reflx + tense'
                        if (first === 'reflx' && parts.length > 1) {
                            return `reflx ${parts[1]}`;
                        }
                        
                        // Group by known categories
                        if (sortOrder.includes(first)) return first;
                        
                        return 'other';
                    };

                    // Execute Grouping
                    const groups = {};
                    mapData.forEach(item => {
                        const key = getGroupKey(item);
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                    });
                    
                    // Render Helper
                    const renderGroup = (items, label) => {
                        const cleanItems = items.map(item => {
                            // Strip the label (case insensitive) from the start of the item
                            const escapedLabel = label.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&');
                            const regex = new RegExp(`^${escapedLabel}\s+`, 'i');
                            return item.replace(regex, '');
                        });
                        
                        const itemsHtml = cleanItems
                            .map(item => `<span class="dpd-inflection-item">${item}</span>`)
                            .join('');
                            
                        const labelHtml = label !== 'other' 
                            ? `<span class="group-label">${label}:</span>` 
                            : '';
                            
                        return `<div class="inflection-group ${'group-' + label.replace(' ', '-')}">${labelHtml}${itemsHtml}</div>`;
                    };
                    
                    // Sort Keys and Build HTML
                    const sortedKeys = Object.keys(groups).sort((a, b) => {
                        if (a === 'other') return 1; // 'other' always last
                        if (b === 'other') return -1;
                        
                        const ia = sortOrder.indexOf(a);
                        const ib = sortOrder.indexOf(b);
                        
                        // If both are in sortOrder, compare indices
                        if (ia !== -1 && ib !== -1) return ia - ib;
                        
                        // If one is in sortOrder, it comes first
                        if (ia !== -1) return -1;
                        if (ib !== -1) return 1;
                        
                        // Handling 'reflx ...' vs 'reflx ...' or unknown
                        return a.localeCompare(b);
                    });
                    
                    const parts = sortedKeys.map(key => renderGroup(groups[key], key));
                    inflectionHtmlContent = parts.join('');
                }
            } catch (e) { }
        }

        // Append Stem & Pattern Info
        let metaHtml = '';
        if (data.stem && data.pattern) {
            metaHtml = `<div class="stem-pattern-info">${data.stem} • ${data.pattern}</div>`;
        }

        // Inflection Map (Grammatical Context) - Line 0 (Above Lemma)
        let line0 = '';
        
        // 1. Stem/Pattern Info (Top of Line 0)
        line0 += metaHtml;

        // 2. Grammatical Inflection Info
        if (isSimilar) {
            // Similar Group: Show Matched Key
            const matchedKeyHtml = `<div class="inflection-group group-key"><span class="dpd-matched-key">matched: <b>${data.lookup_key}</b></span></div>`;
            line0 += `<div class="dpd-inflection-info">${matchedKeyHtml}${inflectionHtmlContent}</div>`;
        } else {
            // Standard Group: Just Inflection Info
            if (inflectionHtmlContent) {
                line0 += `<div class="dpd-inflection-info">${inflectionHtmlContent}</div>`;
            }
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
            // Split by newline and wrap items for CSS styling
            const constrItems = construction.split('\n')
                .map(item => item.trim())
                .filter(item => item)
                .map(item => `<span class="dpd-construction-item">${item}</span>`)
                .join('');
                
            line2 = `<div class="dpd-summary-line-2"><span class="dpd-construction">${constrItems}</span></div>`;
        }

        // Line 3: Meaning + Lit Meaning (Stacked Blocks)
        let line3 = `
            <div class="dpd-summary-line-3">
                <div class="dpd-meaning">${meaning}</div>
                ${meaningLit ? `<div class="dpd-meaning-lit">lit. ${meaningLit}</div>` : ''}
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
