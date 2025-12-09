// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // Helper tính thụt lề (Tăng multiplier lên 16px)
        const getPadding = (lvl) => 15 + (lvl * 16);

        // 1. Render Item (Leaf/Subleaf)
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            const paddingLeft = getPadding(level);
            
            let contentHtml = "";
            if (type === 'leaf') {
                contentHtml = `
                    <div class="toc-row-main">${acronym}</div>
                    ${title ? `<div class="toc-row-sub">${title}</div>` : ''}
                `;
            } else {
                contentHtml = `<span class="toc-subleaf-label" title="${title}">${acronym}</span>`;
            }

            return `<div class="toc-item ${type} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${contentHtml}
                    </div>`;
        };

        // 2. Render Branch Header
        const createBranchHeader = (id, childrenHtml, currentLevel) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.original_title || meta.acronym || id.toUpperCase();
            
            const paddingLeft = getPadding(currentLevel);
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

        // Recursion
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