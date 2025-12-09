// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // Helper: Render Leaf Item (Bài kinh lẻ)
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const label = meta.acronym || meta.original_title || id.toUpperCase();
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            const paddingLeft = 15 + (level * 15); 
            
            return `<div class="toc-item ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        <span class="toc-label">${label}</span>
                        ${meta.translated_title ? `<span class="toc-sub">${meta.translated_title}</span>` : ''}
                    </div>`;
        };

        // Helper: Render Branch Header (Nhóm/Chương)
        // [FIXED] Giờ đây Branch Header cũng có thể click được nếu nó là một UID thực thụ
        const createBranchHeader = (id, childrenHtml) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.acronym || id.toUpperCase();
            
            // Tính toán style
            const paddingLeft = 15 + (level * 15);
            const isActive = id === currentUid ? "active" : "";
            
            // Nếu ID này có trong Meta, nghĩa là nó là một entity có thể load được -> Thêm onClick
            // Nếu không (ví dụ key rác của JSON), chỉ hiển thị text
            const isClickable = !!metaMap[id];
            const action = (isClickable && !isActive) ? `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"` : "";
            const cursorClass = isClickable ? "clickable" : "";

            return `<div class="toc-branch-wrapper">
                        <div class="toc-header ${isActive} ${cursorClass}" ${action} style="padding-left: ${paddingLeft}px">
                            ${label}
                        </div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        if (typeof node === 'string') {
            return createItem(node);
        } 
        else if (Array.isArray(node)) {
            // Array chỉ là container thuần túy, duyệt qua con
            node.forEach(child => {
                html += this.render(child, currentUid, metaMap, level);
            });
        } 
        else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                // Đệ quy lấy nội dung con trước
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                
                // Render Header cho nhánh này
                html += createBranchHeader(key, childrenHtml);
            }
        }
        return html;
    }
};