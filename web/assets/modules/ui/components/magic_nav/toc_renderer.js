// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    render(node, currentUid, metaMap) {
        let html = ``;
        
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const label = meta.acronym || meta.original_title || id.toUpperCase();
            const isActive = id === currentUid ? "active" : "";
            // Gọi hàm global toggleTOC để đóng sau khi click
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            return `<div class="toc-item ${isActive}" ${action}>
                        <span class="toc-label">${label}</span>
                        ${meta.translated_title ? `<span class="toc-sub">${meta.translated_title}</span>` : ''}
                    </div>`;
        };

        if (typeof node === 'string') {
            return createItem(node);
        } else if (Array.isArray(node)) {
            html += `<div class="toc-group">`;
            node.forEach(child => {
                html += this.render(child, currentUid, metaMap);
            });
            html += `</div>`;
        } else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                html += `<div class="toc-branch">`;
                html += this.render(node[key], currentUid, metaMap);
                html += `</div>`;
            }
        }
        return html;
    }
};