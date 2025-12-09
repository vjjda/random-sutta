// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // 1. Render Item (Leaf/Subleaf)
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            // Xác định loại node dựa trên meta, nếu thiếu thì đoán qua level
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Tính toán thụt lề
            const paddingLeft = 15 + (level * 12); 
            
            let contentHtml = "";

            if (type === 'leaf') {
                // [LEAF] 2 dòng: Acronym + Title
                contentHtml = `
                    <div class="toc-row-main">${acronym}</div>
                    ${title ? `<div class="toc-row-sub">${title}</div>` : ''}
                `;
            } else {
                // [SUBLEAF] 1 dòng: Chỉ Acronym (Low profile)
                // Nếu muốn hiện thêm title khi hover thì dùng title attribute
                contentHtml = `<span class="toc-subleaf-label" title="${title}">${acronym}</span>`;
            }

            return `<div class="toc-item ${type} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${contentHtml}
                    </div>`;
        };

        // 2. Render Branch Header (Nhóm/Chương)
        const createBranchHeader = (id, childrenHtml, currentLevel) => {
            const meta = metaMap[id] || {};
            
            // [REQ] Ưu tiên Translated > Original > ID
            const label = meta.translated_title || meta.original_title || meta.acronym || id.toUpperCase();
            
            const paddingLeft = 15 + (currentLevel * 10);
            const isActive = id === currentUid ? "active" : "";
            const isClickable = !!metaMap[id]; // Branch có thể click nếu nó là 1 entity (như kn)
            const action = (isClickable && !isActive) ? `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"` : "";
            
            const classes = `toc-header ${isClickable ? 'clickable' : ''} ${isActive}`;

            return `<div class="toc-branch-wrapper">
                        <div class="${classes}" ${action} style="padding-left: ${paddingLeft}px">
                            ${label}
                        </div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        // --- Recursive Traversal ---
        
        if (typeof node === 'string') {
            return createItem(node);
        } 
        else if (Array.isArray(node)) {
            node.forEach(child => {
                html += this.render(child, currentUid, metaMap, level);
            });
        } 
        else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                // Đệ quy
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                // Header
                html += createBranchHeader(key, childrenHtml, level);
            }
        }
        return html;
    }
};