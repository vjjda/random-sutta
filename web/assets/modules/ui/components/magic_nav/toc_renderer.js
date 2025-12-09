// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // Helper: Render Leaf Item
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const label = meta.acronym || meta.original_title || id.toUpperCase();
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Level 0 không cần padding, Level > 0 padding tăng dần
            const paddingLeft = 15 + (level * 15); 
            
            return `<div class="toc-item ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        <span class="toc-label">${label}</span>
                        ${meta.translated_title ? `<span class="toc-sub">${meta.translated_title}</span>` : ''}
                    </div>`;
        };

        // Helper: Render Branch Header
        const createBranchHeader = (id, childrenHtml) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.acronym || id.toUpperCase();
            const paddingLeft = 15 + (level * 15);

            return `<div class="toc-branch-wrapper">
                        <div class="toc-header" style="padding-left: ${paddingLeft}px">${label}</div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        if (typeof node === 'string') {
            // Case 1: Leaf Node
            return createItem(node);
        } 
        else if (Array.isArray(node)) {
            // Case 2: Array Container (Chỉ là wrapper, không có tên riêng)
            node.forEach(child => {
                html += this.render(child, currentUid, metaMap, level);
            });
        } 
        else if (typeof node === 'object' && node !== null) {
            // Case 3: Branch Object (Có key là ID nhánh)
            for (const key in node) {
                // Đệ quy xuống con với level + 1
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                
                // Nếu key là một UID có trong meta (ví dụ: 'kn', 'dn'), hiển thị nó như Header
                // Nếu không có trong meta, vẫn hiển thị Key dạng raw để phân cấp
                html += createBranchHeader(key, childrenHtml);
            }
        }
        return html;
    }
};