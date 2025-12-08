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
            
            if (pli) {
                segmentHtml += `<span class="pli" lang="pi">${pli}</span>`;
            }
            if (eng) {
                segmentHtml += `<span class="eng" lang="en">${eng}</span>`;
            }
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

    // --- 2. RENDER BRANCH STRUCTURE (SHALLOW MENU) ---
    compileBranch: function (structure, rootUid, metaMap) {
        if (!structure) return "";

        let html = `<div class="branch-container">`;
        
        // 1. Xác định Node mục tiêu trong cây
        // Structure thường có dạng: { "an": ["an1", "an2"] }
        // Nếu ta đang ở "an", ta muốn lấy giá trị của key "an"
        let targetNode = structure;
        
        if (structure[rootUid]) {
            targetNode = structure[rootUid];
        } else {
            // Trường hợp rootUid không phải là key ở cấp cao nhất (ví dụ node con sâu hơn được truyền vào)
            // Giữ nguyên targetNode là structure hiện tại
        }

        // 2. Chỉ render con trực tiếp (Immediate Children)
        html += `<ul class="branch-group">`;

        // Case A: List (Danh sách ID con) -> Render từng ID
        if (Array.isArray(targetNode)) {
            targetNode.forEach(childId => {
                if (typeof childId === 'string') {
                    html += this._createCard(childId, metaMap, "leaf");
                } else if (typeof childId === 'object') {
                    // Nếu con là object (nhóm con), render key của nó
                    Object.keys(childId).forEach(key => {
                        html += this._createCard(key, metaMap, "group");
                    });
                }
            });
        } 
        // Case B: Object (Dictionary các nhóm con) -> Render Key
        else if (typeof targetNode === 'object' && targetNode !== null) {
            Object.keys(targetNode).forEach(key => {
                html += this._createCard(key, metaMap, "group");
            });
        }

        html += `</ul>`;
        html += `</div>`;
        return html;
    },

    _createCard: function (uid, metaMap, type) {
        const info = metaMap[uid] || {};
        // Fallback tên hiển thị
        const title = info.translated_title || info.original_title || uid;
        const acronym = info.acronym || uid.toUpperCase();
        
        // Chỉ hiện blurb nếu có và ngắn gọn
        const blurb = info.blurb ? `<div class="b-blurb">${info.blurb}</div>` : "";
        
        // CSS Class: group (có mũi tên/đậm) hoặc leaf (bài kinh)
        const cssClass = type === "group" ? "branch-card-group" : "branch-card-leaf";

        // Badge loại sách
        let badge = "";
        if (info.type === 'sub_book') badge = `<span class="b-badge">Book</span>`;
        else if (info.type === 'branch') badge = `<span class="b-badge">Section</span>`;
        
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