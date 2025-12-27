// Path: web/assets/modules/lookup/renderers/pali/pali_decon_renderer.js

export const PaliDeconRenderer = {
    render(word, components) {
        if (!components) {
             return `
            <div class="dpd-deconstruction">
                <p class="decon-key"><b>${word}</b></p>
            </div>`;
        }

        const rows = components.split(';').map(r => r.trim()).filter(r => r);
        let html = `
        <div class="dpd-deconstruction">
            <div class="dpd-summary-line-1">
                <span class="decon-key">${word}</span>
                <span class="dpd-pos">deconstruction</span>
            </div>
            <table class="dpd-deconstruction-table">`;
        
        rows.forEach(row => {
            const parts = row.split('+').map(p => p.trim());
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