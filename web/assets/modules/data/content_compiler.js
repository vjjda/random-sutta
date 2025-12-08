// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
    // --- 1. RENDER TEXT CONTENT (LEAF) ---
    compile: function (contentMap, rootUid) {
        if (!contentMap) return "";
        
        // Sort keys tự nhiên (1.1, 1.2, 1.10)
        const sortedKeys = Object.keys(contentMap).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        let html = '<article>';
        
        sortedKeys.forEach(segmentId => {
            const seg = contentMap[segmentId];
            const { pli, eng, html: htmlDecor, comm } = seg;

            let openTag = "";
            let closeTag = "";
            
            if (htmlDecor) {
                const parts = htmlDecor.split("{}");
                if (parts.length === 2) {
                    openTag = parts[0];
                    closeTag = parts[1];
                }
            }

            let segmentHtml = `<span id="${segmentId}" class="segment">`;
            if (pli) segmentHtml += `<span class="pli" lang="pi">${pli}</span>`;
            if (eng) segmentHtml += `<span class="eng" lang="en">${eng}</span>`;
            
            if (comm) {
                const safeComm = comm.replace(/"/g, '&quot;');
                segmentHtml += `<span class="comment-marker" title="View note" data-comment="${safeComm}">*</span>`;
            }
            
            segmentHtml += `</span>`; 
            html += `${openTag}${segmentHtml}${closeTag}`;
        });

        html += '</article>';
        return html;
    },

    // --- 2. RENDER BRANCH STRUCTURE (MENU) ---
    compileBranch: function (structure, rootUid, metaMap) {
        if (!structure) return `<div class="error-message">Structure is empty.</div>`;

        // 1. Tìm Node mục tiêu
        const targetNode = this._findNode(structure, rootUid);
        
        if (!targetNode) {
            console.error(`[Compiler] Node '${rootUid}' not found in tree:`, structure);
            return `<div class="error-message">
                <h3>Content Not Found</h3>
                <p>Could not find branch '<b>${rootUid}</b>' in the book structure.</p>
            </div>`;
        }

        let html = `<div class="branch-container">`;
        html += `<ul class="branch-group">`;

        // Chuẩn hóa items để render
        let itemsToRender = [];
        if (Array.isArray(targetNode)) {
            itemsToRender = targetNode;
        } else if (typeof targetNode === 'object' && targetNode !== null) {
            itemsToRender = Object.keys(targetNode);
        }

        if (itemsToRender.length === 0) {
            return `<div class="error-message">Branch '${rootUid}' has no children.</div>`;
        }

        itemsToRender.forEach(item => {
            let uid = null;
            // Nếu item là string (Leaf ID): "dn1"
            if (typeof item === 'string') {
                uid = item;
            } 
            // Nếu item là object (Branch con): { "long": [...] }
            else if (typeof item === 'object') {
                uid = Object.keys(item)[0];
            }

            if (uid) {
                // Xác định loại để style CSS
                const info = metaMap[uid] || {};
                const metaType = info.type || 'leaf';
                // Các loại này render dạng thẻ lớn (Group), còn lại là thẻ nhỏ (Leaf)
                const isGroup = ['branch', 'book', 'sub_book', 'super_book', 'root'].includes(metaType);
                
                html += this._createCard(uid, metaMap, isGroup ? 'group' : 'leaf');
            }
        });

        html += `</ul>`;
        html += `</div>`;
        return html;
    },

    // Helper: Tìm node đệ quy
    _findNode: function(tree, targetUid) {
        // 1. Direct Access
        if (tree[targetUid]) return tree[targetUid];

        // 2. Recursive Search
        let children = [];
        if (Array.isArray(tree)) {
            children = tree;
        } else if (typeof tree === 'object' && tree !== null) {
            children = Object.values(tree);
        }

        for (const child of children) {
            if (typeof child === 'object' && child !== null) {
                // Nếu child là { "targetUid": [...] } -> Found!
                if (child[targetUid]) return child[targetUid];
                
                // Nếu không, tìm sâu hơn
                const found = this._findNode(child, targetUid);
                if (found) return found;
            }
        }
        return null;
    },

    _createCard: function (uid, metaMap, type) {
        const info = metaMap[uid] || {};
        const title = info.translated_title || info.original_title || uid;
        const acronym = info.acronym || uid.toUpperCase();
        
        // CSS Class
        const cssClass = type === "group" ? "branch-card-group" : "branch-card-leaf";
        
        // Badge
        let badge = "";
        const t = info.type;
        if (t === 'root') badge = `<span class="b-badge">Root</span>`;
        else if (t === 'super_book') badge = `<span class="b-badge">Collection</span>`;
        else if (t === 'sub_book') badge = `<span class="b-badge">Part</span>`;
        else if (t === 'book') badge = `<span class="b-badge">Book</span>`;
        else if (t === 'branch') badge = `<span class="b-badge">Section</span>`;

        // Blurb (Chỉ hiện cho Group lớn)
        const blurb = (info.blurb && type === 'group') 
            ? `<div class="b-blurb">${info.blurb}</div>` 
            : "";

        return `
        <li class="${cssClass}">
            <a href="javascript:void(0)" onclick="window.loadSutta('${uid}')" class="b-card-link">
                <div class="b-content">
                    <div class="b-header">
                        <span class="b-title">${title}</span>
                        <span class="b-orig">${acronym}</span>
                    </div>
                    ${blurb}
                    ${badge ? `<div class="b-footer">${badge}</div>` : ''}
                </div>
            </a>
        </li>
        `;
    }
};