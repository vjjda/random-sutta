// Path: web/assets/modules/data/content_compiler.js

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
            const { pli, eng, html: htmlDecor, comm } = seg; // [UPDATED] Lấy thêm comm

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
            
            if (pli) {
                segmentHtml += `<span class="pli" lang="pi">${pli}</span>`;
            }
            
            if (eng) {
                segmentHtml += `<span class="eng" lang="en">${eng}</span>`;
            }

            // [NEW] Logic Render Comment
            if (comm) {
                // Escape dấu nháy kép để tránh vỡ HTML attribute
                const safeComm = comm.replace(/"/g, '&quot;');
                // Giữ nguyên class 'comment-marker' và data-comment để popup.js hoạt động
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

        let html = `<div class="branch-container">`;
        
        const buildTreeHtml = (node, depth = 0) => {
            let out = "";
            
            if (Array.isArray(node)) {
                out += `<ul class="branch-group depth-${depth}">`;
                node.forEach(child => {
                    out += buildTreeHtml(child, depth);
                });
                out += `</ul>`;
            } 
            else if (typeof node === 'object' && node !== null) {
                Object.keys(node).forEach(key => {
                    out += this._createCard(key, metaMap, "group");
                    out += buildTreeHtml(node[key], depth + 1);
                });
            } 
            else if (typeof node === 'string') {
                out += this._createCard(node, metaMap, "leaf");
            }
            
            return out;
        };

        let rootNode = structure;
        if (structure[rootUid]) {
            rootNode = structure[rootUid];
        }

        html += buildTreeHtml(rootNode);
        html += `</div>`;
        return html;
    },

    _createCard: function (uid, metaMap, type) {
        const info = metaMap[uid] || {};
        const title = info.translated_title || info.original_title || uid;
        const acronym = info.acronym || uid.toUpperCase();
        const blurb = info.blurb ? `<div class="b-blurb">${info.blurb}</div>` : "";
        const cssClass = type === "group" ? "branch-card-group" : "branch-card-leaf";

        let badge = "";
        if (info.type === 'sub_book') badge = `<span class="b-badge">Book</span>`;
        
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