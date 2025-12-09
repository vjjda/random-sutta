// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js";

// [NEW] Helper tạo nút ngữ cảnh
function createContextLink(currentUid, metaEntry, contextMeta) {
    if (!metaEntry || !metaEntry.parent_uid) return "";

    const parentId = metaEntry.parent_uid;
    // Tìm thông tin của Parent trong contextMeta (đã được load sẵn từ Controller)
    const parentMeta = contextMeta[parentId] || {};
    
    // Tên hiển thị của Parent (Ưu tiên Acronym -> Title -> UID)
    const parentLabel = parentMeta.acronym || parentMeta.translated_title || parentId.toUpperCase();
    
    // Target ID: Ưu tiên extract_id (ID cụ thể của segment đầu) hoặc dùng chính UID subleaf
    const targetId = metaEntry.extract_id || currentUid;
    
    // Tạo lệnh gọi loadSutta với cú pháp: 'parentID#targetID'
    // transition: true để tạo hiệu ứng mượt
    const action = `window.loadSutta('${parentId}#${targetId}', true, 0, { transition: true })`;

    return `
        <div class="sutta-context-bar">
            <span class="ctx-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    <path d="M15 8l3-3m0 0l3 3m-3-3v10"></path> </svg>
            </span>
            <span class="ctx-label">Full context:</span>
            <button onclick="${action}" class="ctx-link" title="Read in ${parentLabel}">
                ${parentLabel}
            </button>
        </div>
    `;
}

function getDisplayInfo(uid, metaEntry) {
    // ... (Giữ nguyên code cũ) ...
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
        // 1. Compile nội dung chính
        let htmlContent = ContentCompiler.compile(data.content, data.uid);
        
        // [NEW] 2. Inject Context Link vào đầu (nếu là Subleaf)
        // Dữ liệu meta của Parent nằm trong data.contextMeta 
        const contextHtml = createContextLink(data.uid, data.meta, data.contextMeta);
        
        if (contextHtml) {
            // Chèn vào trước nội dung kinh
            htmlContent = contextHtml + htmlContent;
        }

        const displayInfo = getDisplayInfo(data.uid, data.meta);
        return {
            html: htmlContent,
            displayInfo: displayInfo
        };
    }
};