// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    // Helper: Kiểm tra xem cây con (node) có chứa currentUid không
    _containsActiveUid(node, currentUid) {
        if (typeof node === 'string') {
            return node === currentUid;
        } 
        if (Array.isArray(node)) {
            return node.some(child => this._containsActiveUid(child, currentUid));
        } 
        if (typeof node === 'object' && node !== null) {
            // Kiểm tra keys (nếu key chính là uid) hoặc values (con cháu)
            for (const [key, val] of Object.entries(node)) {
                if (key === currentUid) return true;
                if (this._containsActiveUid(val, currentUid)) return true;
            }
        }
        return false;
    },

    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        // Helper: Icon Mũi tên Toggle
        const getToggleIcon = () => `
            <span class="toc-toggle-icon" onclick="event.stopPropagation(); MagicNav.toggleNode(this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </span>`;

        // 1. Render Leaf Item (Bài kinh lẻ - Không có con)
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            const paddingLeft = 15 + (level * 16); 
            
            let contentHtml = "";
            if (type === 'leaf') {
                contentHtml = `<div class="toc-row-main">${acronym}</div>${title ? `<div class="toc-row-sub">${title}</div>` : ''}`;
            } else {
                contentHtml = `<span class="toc-subleaf-label" title="${title}">${acronym}</span>`;
            }

            return `<div class="toc-item ${type} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${contentHtml}
                    </div>`;
        };

        // 2. Render Branch/Group Header (Có con)
        const createBranchHeader = (id, childrenHtml, currentLevel, rawChildNode) => {
            const meta = metaMap[id] || {};
            const label = meta.translated_title || meta.original_title || meta.acronym || id.toUpperCase();
            const paddingLeft = 15 + (currentLevel * 10);
            const isActive = id === currentUid ? "active" : "";
            const isClickable = !!metaMap[id];
            
            // Logic Click Header:
            // - Nếu là Leaf-Parent (e.g., AN 1.1-10): Click vào text -> Load bài kinh.
            // - Nếu là Branch (Vagga): Click vào text -> Toggle đóng mở (cho tiện).
            let headerAction = "";
            if (isClickable && !isActive) {
                headerAction = `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            } else if (!isClickable) {
                // Nếu không load được, click vào text sẽ toggle luôn
                headerAction = `onclick="MagicNav.toggleNode(this)"`; 
            }

            const classes = `toc-header ${isClickable ? 'clickable' : ''} ${isActive}`;
            const type = meta.type || 'branch';

            // --- LOGIC COLLAPSE ---
            // Mặc định: Expand hết.
            // Ngoại lệ: Nếu là 'leaf' (Leaf-Parent) -> Collapse.
            let isCollapsed = false;
            
            // Kiểm tra xem trong đám con cháu có thằng nào đang Active không
            const hasActiveChild = this._containsActiveUid(rawChildNode, currentUid);
            const isSelfActive = (id === currentUid);

            if (type === 'leaf') {
                // Nếu là Leaf-Parent: Đóng lại, TRỪ KHI đang xem chính nó hoặc xem con nó
                if (!hasActiveChild && !isSelfActive) {
                    isCollapsed = true;
                }
            }
            // Các trường hợp khác (Branch): Luôn mở (isCollapsed = false)

            const collapsedClass = isCollapsed ? "collapsed" : "";

            return `<div class="toc-node-wrapper ${collapsedClass}">
                        <div class="toc-header-row" style="padding-left: ${paddingLeft}px">
                            <div class="${classes}" ${headerAction} style="flex: 1;">
                                ${label}
                            </div>
                            ${getToggleIcon()} 
                        </div>
                        <div class="toc-children">${childrenHtml}</div>
                    </div>`;
        };

        // --- Recursive Traversal ---
        if (typeof node === 'string') {
            return createItem(node);
        } 
        else if (Array.isArray(node)) {
            node.forEach(child => html += this.render(child, currentUid, metaMap, level));
        } 
        else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                const childrenHtml = this.render(node[key], currentUid, metaMap, level + 1);
                // Truyền node[key] vào để check active child
                html += createBranchHeader(key, childrenHtml, level, node[key]);
            }
        }
        return html;
    }
};