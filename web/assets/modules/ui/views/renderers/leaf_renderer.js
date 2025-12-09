// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js";

// [UPDATED] Helper tạo Footer "See also"
function createContextFooter(currentUid, metaEntry, contextMeta) {
    if (!metaEntry || !metaEntry.parent_uid) return "";

    const parentId = metaEntry.parent_uid;
    const parentMeta = contextMeta[parentId] || {};
    
    // 1. Lấy Acronym (VD: Dhp, MN)
    const acronym = parentMeta.acronym || parentId.toUpperCase();
    
    // 2. Lấy Title (VD: The Dhammapada)
    const title = parentMeta.translated_title || parentMeta.original_title || "";
    
    // 3. Kết hợp: "Dhp: The Dhammapada"
    let displayLabel = acronym;
    if (title && title.toLowerCase() !== acronym.toLowerCase()) {
        displayLabel = `${acronym}: ${title}`;
    }
    
    const targetId = metaEntry.extract_id || currentUid;
    const action = `window.loadSutta('${parentId}#${targetId}', true, 0, { transition: true })`;

    return `
        <div class="sutta-context-footer">
            <span class="ctx-label">See also:</span>
            <button onclick="${action}" class="ctx-link" title="Read full text in ${displayLabel}">
                ${displayLabel}
            </button>
        </div>
    `;
}

function getDisplayInfo(uid, metaEntry) {
    let main = uid.toUpperCase();
    let sub = "";
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaEntry) {
        main = metaEntry.acronym || main;
        sub = metaEntry.translated_title || metaEntry.original_title || "";
    }
    return { main, sub };
}

export const LeafRenderer = {
    render(data) {
        let htmlContent = ContentCompiler.compile(data.content, data.uid);
        
        // Inject Footer
        const footerHtml = createContextFooter(data.uid, data.meta, data.contextMeta);
        
        if (footerHtml) {
            htmlContent = htmlContent + footerHtml;
        }

        const displayInfo = getDisplayInfo(data.uid, data.meta);
        return {
            html: htmlContent,
            displayInfo: displayInfo
        };
    }
};