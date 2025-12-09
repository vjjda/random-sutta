// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Phân loại Leaf (Cấp 0) và Subleaf (Cấp sâu hơn)
            const typeClass = level === 0 ? "leaf" : "subleaf";
            
            // Subleaf thụt lề sâu hơn
            const paddingLeft = level === 0 ? 15 : (20 + level * 15);
            
            // Logic hiển thị nội dung
            let content = "";
            if (level === 0) {
                // Leaf: Acronym đậm, Title ở dưới hoặc bên cạnh
                content = `<span class="toc-label">${acronym}</span>`;
                if (title) content += `<span class="toc-sub">${title}</span>`;
            } else {
                // Subleaf: Chỉ hiện Acronym hoặc Title (ưu tiên cái nào ngắn gọn)
                // Thường subleaf chỉ cần Acronym (ví dụ: 1.1, 1.2)
                content = `<span class="toc-label">${acronym} ${title ? '- ' + title : ''}</span>`;
            }

            return `<div class="toc-item ${typeClass} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${content}
                    </div>`;
        };

        const createBranchHeader = (id, childrenHtml) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.acronym || id.toUpperCase();
            const paddingLeft = 15; // Header luôn sát lề trái
            const isActive = id === currentUid ? "active" : "";
            const isClickable = !!metaMap[id];
            const action = (isClickable && !isActive) ? `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"` : "";
            
            return `<div class="toc-branch-wrapper">
                        <div class="toc-header ${isClickable ? 'clickable' : ''} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                            ${label}
                        </div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        if (typeof node === 'string') {
            return createItem(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => {
                html += this.render(child, currentUid, metaMap, level);
            });
        } else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                // Level 0 Object keys là Branch Header
                if (level === 0) {
                    html += createBranchHeader(key, childrenHtml);
                } else {
                    // Nếu đã ở trong branch con, chỉ render tiếp mà không tạo header to
                    html += childrenHtml; 
                }
            }
        }
        return html;
    }
};