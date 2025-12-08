// Path: web/assets/modules/data/content_compiler.js

const SEGMENT_REGEX = /^([a-z]+[\d\.-]+):(\d+\.\d+(\.\d+)?)$/;

export const ContentCompiler = {
    // --- 1. RENDER TEXT CONTENT (LEAF) ---
    compile: function (contentMap, rootUid) {
        if (!contentMap) return "";

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
        if (!structure) return "";

        // 1. Tìm Node mục tiêu trong cây (Deep Search)
        const targetNode = this._findNode(structure, rootUid);
        
        if (!targetNode) {
            return `<div class="error-message">Empty structure for ${rootUid}</div>`;
        }

        let html = `<div class="branch-container">`;
        html += `<ul class="branch-group">`;

        // Logic Render:
        // - Nếu Node là List: Render từng item trong list.
        // - Nếu Node là Dict: Render Keys của Dict.
        
        const itemsToRender = Array.isArray(targetNode) ? targetNode : Object.keys(targetNode);

        itemsToRender.forEach(item => {
            let uid, childNode;

            if (typeof item === 'string') {
                uid = item; // Item là ID
            } else if (typeof item === 'object') {
                // Item là object { "key": [...] }, lấy key đầu tiên
                uid = Object.keys(item)[0];
            }

            if (uid) {
                // Determine Visual Type based on Meta Type, NOT structure type
                const info = metaMap[uid] || {};
                const metaType = info.type || 'leaf';
                
                // Nếu là 'leaf' hoặc 'subleaf' -> Render kiểu bài kinh (nhỏ)
                // Nếu là 'branch', 'book', 'sub_book' -> Render kiểu nhóm (lớn)
                const renderType = ['leaf', 'subleaf', 'alias'].includes(metaType) ? 'leaf' : 'group';
                
                html += this._createCard(uid, metaMap, renderType);
            }
        });

        html += `</ul>`;
        html += `</div>`;
        return html;
    },

    // Helper: Tìm node tương ứng với UID trong cây lồng nhau
    _findNode: function(tree, targetUid) {
        // 1. Check Root Keys
        if (tree[targetUid]) return tree[targetUid];

        // 2. Recursive Search
        // Tree có thể là Dict hoặc List
        let children = [];
        if (Array.isArray(tree)) children = tree;
        else if (typeof tree === 'object') children = Object.values(tree);

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
        const blurb = info.blurb ? `<div class="b-blurb">${info.blurb}</div>` : "";
        
        // CSS: Group (đậm/lớn), Leaf (nhỏ/phẳng)
        const cssClass = type === "group" ? "branch-card-group" : "branch-card-leaf";

        // Badge phân loại
        let badge = "";
        if (info.type === 'book') badge = `<span class="b-badge">Book</span>`;
        else if (info.type === 'sub_book') badge = `<span class="b-badge">Part</span>`;
        else if (info.type === 'branch') badge = `<span class="b-badge">Section</span>`;
        else if (info.type === 'super_book') badge = `<span class="b-badge">Collection</span>`;
        
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