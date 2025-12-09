// Path: web/assets/modules/ui/components/magic_nav/toc_renderer.js
export const TocRenderer = {
    _containsActiveUid(node, currentUid) {
        if (typeof node === 'string') return node === currentUid;
        if (Array.isArray(node)) return node.some(child => this._containsActiveUid(child, currentUid));
        if (typeof node === 'object' && node !== null) {
            for (const [key, val] of Object.entries(node)) {
                if (key === currentUid) return true;
                if (this._containsActiveUid(val, currentUid)) return true;
            }
        }
        return false;
    },

    render(node, currentUid, metaMap, level = 0) {
        let html = ``;
        
        const getToggleIcon = () => `
            <span class="toc-toggle-icon" onclick="event.stopPropagation(); MagicNav.toggleNode(this)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>`;

        // --- CONTENT GENERATOR ---
        // Hàm tạo nội dung HTML bên trong thẻ div (dùng chung cho cả Item và Header)
        const generateInnerContent = (id, type) => {
            const meta = metaMap[id] || {};
            const acronym = meta.acronym || id.toUpperCase();
            const title = meta.translated_title || meta.original_title || "";

            if (type === 'leaf') {
                // [LEAF STYLE] 2 dòng: Acronym đậm + Title nhạt
                return `
                    <div class="toc-text-container">
                        <div class="toc-row-main">${acronym}</div>
                        ${title ? `<div class="toc-row-sub">${title}</div>` : ''}
                    </div>
                `;
            } else if (type === 'subleaf') {
                // [SUBLEAF STYLE] 1 dòng: Title hoặc Acronym (Low profile)
                return `<div class="toc-subleaf-label" title="${title}">${acronym}</div>`;
            } else {
                // [BRANCH STYLE] 1 dòng: Ưu tiên Translated Title, In hoa
                const branchLabel = meta.translated_title || meta.original_title || meta.acronym || id.toUpperCase();
                return `<div class="toc-branch-label">${branchLabel}</div>`;
            }
        };

        // 1. Render Single Item (Không có con)
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const type = meta.type || (level === 0 ? 'leaf' : 'subleaf');
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            
            // Subleaf thụt sâu hơn Leaf
            const paddingLeft = 15 + (level * 16); 
            
            return `<div class="toc-item ${type} ${isActive}" ${action} style="padding-left: ${paddingLeft}px">
                        ${generateInnerContent(id, type)}
                    </div>`;
        };

        // 2. Render Parent Node (Có con - Branch hoặc Leaf Container)
        const createParentNode = (id, childrenHtml, currentLevel, rawChildNode) => {
            const meta = metaMap[id] || {};
            // [IMPORTANT] Xác định type chính xác từ Meta
            const type = meta.type || 'branch'; 
            
            const paddingLeft = 15 + (currentLevel * 10);
            const isActive = id === currentUid ? "active" : "";
            const isClickable = !!metaMap[id];
            
            let headerAction = "";
            if (isClickable && !isActive) {
                headerAction = `onclick="window.loadSutta('${id}'); MagicNav.toggleTOC()"`;
            } else if (!isClickable) {
                headerAction = `onclick="MagicNav.toggleNode(this)"`; 
            }

            // Collapse Logic
            let isCollapsed = false;
            const hasActiveChild = this._containsActiveUid(rawChildNode, currentUid);
            const isSelfActive = (id === currentUid);

            // Chỉ tự động đóng nếu là Leaf Container và không liên quan đến trang hiện tại
            if (type === 'leaf') {
                if (!hasActiveChild && !isSelfActive) isCollapsed = true;
            }
            
            const collapsedClass = isCollapsed ? "collapsed" : "";
            const classes = `toc-header type-${type} ${isClickable ? 'clickable' : ''} ${isActive}`;

            return `<div class="toc-node-wrapper ${collapsedClass}">
                        <div class="toc-header-row" style="padding-left: ${paddingLeft}px">
                            <div class="${classes}" ${headerAction}>
                                ${generateInnerContent(id, type)}
                            </div>
                            ${getToggleIcon()} 
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
                // Gọi createParentNode cho Key
                html += createParentNode(key, childrenHtml, level, node[key]);
            }
        }
        return html;
    }
};