// Path: web/assets/modules/lookup/renderers/pali/pali_decon_renderer.js

export const PaliDeconRenderer = {
    render(word, componentsJson) {
        if (!componentsJson) {
             return `
            <div class="dpd-deconstruction">
                <p class="decon-key"><b>${word}</b></p>
            </div>`;
        }

        let rows = [];
        try {
            // New Format: JSON String of Array of Arrays
            // [["a", "b"], ["c", "d"]]
            rows = JSON.parse(componentsJson);
        } catch (e) {
            // Fallback for old format (just in case) or simple string
            console.warn("Decon Parse Error", e);
            return "";
        }

        if (!Array.isArray(rows) || rows.length === 0) return "";

        let html = `
        <div class="dpd-deconstruction">
            <div class="dpd-summary-line-1">
                <span class="decon-key">${word}</span>
                <span class="dpd-pos">deconstruction</span>
            </div>
            <table class="dpd-deconstruction-table">`;
        
        rows.forEach(parts => {
            if (!Array.isArray(parts)) return; // Safety check
            
            html += `<tr>`;
            parts.forEach((part, index) => {
                html += `<td class="decon-cell">${part}</td>`;
                if (index < parts.length - 1) {
                    html += `<td class="decon-plus">+</td>`;
                }
            });
            html += `</tr>`;
        });

        html += `</table></div>`;
        return html;
    }
};