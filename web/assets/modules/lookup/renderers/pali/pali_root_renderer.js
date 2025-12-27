// Path: web/assets/modules/lookup/renderers/pali/pali_root_renderer.js

export const PaliRootRenderer = {
    render(root, getLabel) {
        // Find keys dynamically
        let rootVal = "", meaning = "", grammar = "", sanskrit = "";
        
        for (const [k, v] of Object.entries(root)) {
            const label = getLabel(k).toLowerCase();
            if (label === "root") rootVal = v;
            else if (label === "meaning") meaning = v;
            else if (label === "grammar") grammar = v;
            else if (label === "sanskrit root") sanskrit = v;
        }

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
                        ${sanskrit ? `<span class="root-sanskrit">[${sanskrit}]</span>` : ''}
                        ${grammar ? `<span class="root-grammar" style="margin-left: auto;">${grammar}</span>` : ''}
                    </div>

                    <div class="dpd-summary-line-3">
                        <span class="dpd-meaning root-meaning">${meaning}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }
};