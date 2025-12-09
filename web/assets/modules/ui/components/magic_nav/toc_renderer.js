// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            // [FIX] Ưu tiên meta.type. Nếu là leaf thì luôn render kiểu leaf (bất kể level)
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Padding vẫn tăng theo level để thụt lề đúng cấu trúc cây
            const paddingLeft = 15 + (level * 16); 
            
            let contentHtml = "";

            if (type === 'leaf') {
                // [LEAF STYLE] Luôn hiện đầy đủ: Acronym + Title
                contentHtml = `
                    <div class="toc-row-main">${acronym}</div>
                    ${title ? `<div class="toc-row-sub">${title}</div>` : ''}
                `;
            } else {
                // [SUBLEAF STYLE] Chỉ hiện Acronym hoặc Title ngắn gọn
                contentHtml = `<span class="toc-subleaf-label" title="${title}">${acronym}</span>`;
            }

            return `<div class="toc-item ${type} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${contentHtml}
                    </div>`;
        };

        const createBranchHeader = (id, childrenHtml, currentLevel) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.acronym || id.toUpperCase();
            
            // Header thụt lề ít hơn con 1 chút
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

        if (typeof node === 'string') {
            return createItem(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => html += this.render(child, currentUid, metaMap, level));
        } else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                html += createBranchHeader(key, childrenHtml, level);
            }
        }
        return html;
    }
};