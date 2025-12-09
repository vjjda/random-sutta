// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // 1. Helper: Render Leaf/Subleaf Item
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            // Ưu tiên type từ meta, nếu không có thì đoán qua level
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Tính toán thụt lề
            const paddingLeft = 15 + (level * 16); 
            
            let contentHtml = "";

            // [LEAF STYLE] Luôn hiện đầy đủ: Acronym + Title
            if (type === 'leaf') {
                contentHtml = `
                    <div class="toc-row-main">${acronym}</div>
                    ${title ? `<div class="toc-row-sub">${title}</div>` : ''}
                `;
            } else {
                // [SUBLEAF STYLE] Chỉ hiện Acronym hoặc Title ngắn gọn
                // Nếu subleaf ko có acronym (hiếm), dùng id
                contentHtml = `<span class="toc-subleaf-label" title="${title}">${acronym}</span>`;
            }

            return `<div class="toc-item ${type} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${contentHtml}
                    </div>`;
        };

        // 2. Helper: Render Branch Header (Chỉ dùng cho Group/Branch thật sự)
        const createBranchHeader = (id, childrenHtml, currentLevel) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.original_title || meta.acronym || id.toUpperCase();
            
            const paddingLeft = 15 + (currentLevel * 10);
            const isActive = id === currentUid ? "active" : "";
            const isClickable = !!metaMap[id];
            const action = (isClickable && !isActive) ? `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"` : "";
            const classes = `toc-header ${isClickable ? 'clickable' : ''} ${isActive}`;

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
            node.forEach(child => html += this.render(child, currentUid, metaMap, level));
        } 
        else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                // Lấy meta của Key để kiểm tra Type
                const keyMeta = metaMap[key] || {};
                
                // Đệ quy lấy nội dung con trước (luôn tăng level)
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                
                // [FIX CRITICAL] Phân loại dựa trên Type
                if (keyMeta.type === 'leaf') {
                    // Trường hợp đặc biệt (như AN 2.1-10): Key là một Leaf chứa các Subleaf con
                    // -> Render Key như một Item (đậm), sau đó nối tiếp Children ở dưới
                    html += createItem(key);
                    html += childrenHtml; 
                } else {
                    // Trường hợp thường (Vagga/Nipata): Key là Branch
                    // -> Render Key như Header (nhạt), bọc Children bên trong
                    html += createBranchHeader(key, childrenHtml, level);
                }
            }
        }
        return html;
    }
};