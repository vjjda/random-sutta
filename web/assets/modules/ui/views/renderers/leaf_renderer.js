// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js";

function createContextFooter(currentUid, metaEntry, contextMeta) {
    if (!metaEntry || !metaEntry.parent_uid) return "";

    const parentId = metaEntry.parent_uid;
    const parentMeta = contextMeta[parentId] || {};
    
    // Logic lấy tên: Ưu tiên Translated -> Original -> Acronym
    const acronym = parentMeta.acronym || parentId.toUpperCase();
    const title = parentMeta.translated_title || parentMeta.original_title || "";
    
    // Format hiển thị: "AN 1.1-10: What Occupies the Mind"
    let displayLabel = acronym;
    if (title && title.toLowerCase() !== acronym.toLowerCase()) {
        displayLabel = `${acronym}: ${title}`;
    }
    
    const targetId = metaEntry.extract_id || currentUid;
    // Thêm transition: true để cuộn mượt
    const action = `window.loadSutta('${parentId}#${targetId}', true, 0, { transition: true })`;

    return `
        <div class="sutta-context-footer">
            <span class="ctx-label">See also:</span>
            <button onclick="${action}" class="ctx-link" title="Read full context">
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