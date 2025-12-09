// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // 1. Render Leaf Item (Bài kinh)
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            // Ưu tiên hiển thị ngắn gọn
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            const isActive = id === currentUid ? "active" : "";
            // Đóng TOC sau khi click
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Tính toán thụt lề: Cấp càng sâu càng thụt vào
            const paddingLeft = 15 + (level * 10); 
            
            // Logic hiển thị Text:
            // - Leaf (Level 0/1): Acronym đậm + Title nhạt
            // - Subleaf: Acronym nhỏ
            let contentHtml = `<span class="toc-label">${acronym}</span>`;
            if (title) {
                contentHtml += `<span class="toc-sub">${title}</span>`;
            }

            return `<div class="toc-item leaf ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${contentHtml}
                    </div>`;
        };

        // 2. Render Branch Header (Tên nhóm/Vagga)
        const createBranchHeader = (id, childrenHtml, currentLevel) => {
            const meta = metaMap[id] || {};
            // Nếu không có meta (ví dụ key 'kn'), dùng ID viết hoa
            const label = meta.translated_title || meta.acronym || id.toUpperCase();
            
            // Header thụt lề ít hơn item con 1 chút
            const paddingLeft = 15 + (currentLevel * 10);
            
            // [LOGIC MỚI] Header cũng có thể active nếu đang xem chính nó (trang danh sách)
            const isActive = id === currentUid ? "active" : "";
            const isClickable = !!metaMap[id];
            const action = (isClickable && !isActive) ? `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"` : "";
            const classes = `toc-header level-${currentLevel} ${isClickable ? 'clickable' : ''} ${isActive}`;

            return `<div class="toc-branch-wrapper">
                        <div class="${classes}" ${action} style="padding-left: ${paddingLeft}px">
                            ${label}
                        </div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        // --- Recursive Logic ---
        
        if (typeof node === 'string') {
            return createItem(node);
        } 
        else if (Array.isArray(node)) {
            // Array chỉ là wrapper, duyệt tiếp, KHÔNG tăng level
            node.forEach(child => {
                html += this.render(child, currentUid, metaMap, level);
            });
        } 
        else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                // Đệ quy xuống con (Tăng level)
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                
                // [FIXED] Luôn render Header cho Object Key
                html += createBranchHeader(key, childrenHtml, level);
            }
        }
        return html;
    }
};