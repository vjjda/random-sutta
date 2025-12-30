// Path: web/assets/modules/lookup/renderers/pali/pali_root_renderer.js

export const PaliRootRenderer = {
    render(data, getLabel) {
        // Data contains: headword (root), root_meaning, root_info, sanskrit_info, root_meaning_origin
        const rootVal = data.headword || "";
        const meaning = data.root_meaning || "";
        const grammar = data.root_info || ""; // "Group X Sign"
        const sanskrit = data.sanskrit_info || "";
        const skMeaning = data.root_meaning_origin || "";

        return `
        <div class="dpd-entry dpd-root-entry no-details">
            <div class="dpd-summary">
                <div class="dpd-summary-content">
                    <div class="dpd-summary-line-1">
                        <span class="dpd-lemma root-lemma">${rootVal}</span>
                        <span class="dpd-pos-group">
                            <span class="dpd-pos root-pos">root</span>
                        </span>
                    </div>
                    
                    <div class="dpd-summary-line-2" style="display: flex;">
                        ${sanskrit ? `<span class="root-sanskrit">Skr: [${sanskrit}${skMeaning ? ` (${skMeaning})` : ''}]</span>` : ''}
                        ${grammar ? `<span class="root-grammar" style="margin-left: auto;">Group ${grammar}</span>` : ''}
                    </div>

                    <div class="dpd-summary-line-3">
                        <span class="dpd-meaning root-meaning">${meaning}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }
};