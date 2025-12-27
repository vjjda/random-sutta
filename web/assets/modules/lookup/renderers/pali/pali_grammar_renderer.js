// Path: web/assets/modules/lookup/renderers/pali/pali_grammar_renderer.js

export const PaliGrammarRenderer = {
    renderNotes(notesGroups) {
        let html = `<div class="grammar-note-container">`;
        html += `<table class="grammar-note-table">`;
        html += `<tbody>`;
        
        if (!Array.isArray(notesGroups)) return "";

        notesGroups.forEach(group => {
            // Check structure validity: [h, p, [[...]]]
            if (!Array.isArray(group) || group.length < 3) return;
            
            const [headword, pos, lines] = group;
            
            if (!Array.isArray(lines)) return;

            lines.forEach(line => {
                // line format: [g1, g2, g3...] (Array of strings)
                
                html += `<tr>
                    <td class="col-word"><b>${headword}</b></td>
                    <td class="col-pos">${pos}</td>`;
                
                // Handle split columns
                const g1 = line[0] || "";
                const g2 = line[1] || "";
                
                // Join remaining parts for the last column if > 3 parts
                const g3 = line.slice(2).join(" "); 
                
                html += `<td class="col-g1">${g1}</td>
                         <td class="col-g2">${g2}</td>
                         <td class="col-g3">${g3}</td>`;
                
                html += `</tr>`;
            });
        });
        
        html += `</tbody></table></div>`;
        return html;
    }
};