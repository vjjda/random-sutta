// Path: web/assets/modules/ui/views/renderers/branch_renderer.js
import { ContentCompiler } from "data/content_compiler.js";

// [NEW] Helper để làm phẳng cây cấu trúc (Hoisting)
function flattenSingleChains(structure, metaMap) {
    if (!structure) return structure;
    
    // Nếu structure là mảng (Children list)
    if (Array.isArray(structure)) {
        return structure.map(child => flattenSingleChains(child, metaMap));
    }
    
    // Nếu là Object dạng { "long": ["dn"] }
    if (typeof structure === 'object') {
        const keys = Object.keys(structure);
        if (keys.length === 1) {
            const parentId = keys[0];
            const content = structure[parentId];
            
            // Check Single Child: content là mảng có 1 phần tử
            if (Array.isArray(content) && content.length === 1) {
                const child = content[0];
                
                // Xác định ID của con
                let childId = null;
                if (typeof child === 'string') childId = child;
                else if (typeof child === 'object') childId = Object.keys(child)[0];

                if (childId) {
                    // Logic Gộp Meta:
                    // Bạn muốn meta của 'long' (parent) đóng vai trò header.
                    // Ta có thể update meta của child ('dn') để nối thêm thông tin từ parent
                    // hoặc đơn giản là trả về child structure luôn để render thẳng child.
                    
                    // Ở đây tôi chọn cách trả về child structure, 
                    // ContentCompiler sẽ render thẻ của Child (DN).
                    // Nếu muốn hiển thị tên Parent (Long), ta có thể sửa translated_title của Child tạm thời.
                    
                    /* Optional: Merge Meta Title (VD: "Long Discourses / Digha Nikaya")*/
                    if (metaMap[parentId] && metaMap[childId]) {
                         metaMap[childId].translated_title = metaMap[parentId].acronym + " / " + metaMap[childId].translated_title;
                    }
                    
                   
                    // Đệ quy tiếp cho con (phòng trường hợp chuỗi dài A->B->C)
                    return flattenSingleChains(child, metaMap);
                }
            }
            
            // Nếu không phải single chain, đệ quy bình thường vào giá trị
            return { [parentId]: flattenSingleChains(content, metaMap) };
        }
    }
    
    return structure;
}

export const BranchRenderer = {
    render(data) {
        const metaForMenu = data.contextMeta || {};
        if (data.meta) metaForMenu[data.uid] = data.meta;

        // [UPDATED] Tiền xử lý Structure: Gộp các node đơn
        // Clone để không ảnh hưởng dữ liệu gốc
        const rawStructure = JSON.parse(JSON.stringify(data.bookStructure));
        const optimizedStructure = flattenSingleChains(rawStructure, metaForMenu);

        // 1. Sinh danh sách Card con (đã được làm phẳng)
        const listHtml = ContentCompiler.compileBranch(
            optimizedStructure, 
            data.uid, 
            metaForMenu
        );

        // ... (Phần Header Hero giữ nguyên) ...
        const meta = data.meta || {};
        const title = meta.translated_title || meta.acronym || data.uid.toUpperCase();
        const original = meta.original_title || "";
        const blurb = meta.blurb || "";

        let headerHtml = "";
        if (title || blurb) {
            headerHtml = `
                <div class="branch-hero">
                    <h1 class="branch-hero-title">${title}</h1>
                    ${original ? `<div class="branch-hero-original">${original}</div>` : ''}
                    ${blurb ? `<div class="branch-hero-blurb">${blurb}</div>` : ''}
                    <div class="branch-hero-divider"></div>
                </div>
            `;
        }

        const displayInfo = {
            main: meta.acronym || data.uid.toUpperCase(),
            sub: meta.translated_title || ""
        };

        return {
            html: headerHtml + listHtml,
            displayInfo: displayInfo
        };
    }
};