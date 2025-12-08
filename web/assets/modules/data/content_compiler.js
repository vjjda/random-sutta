// Path: web/assets/modules/data/content_compiler.js

const SEGMENT_REGEX = /^([a-z]+[\d\.-]+):(\d+\.\d+(\.\d+)?)$/;

export const ContentCompiler = {
    // --- 1. RENDER TEXT CONTENT (LEAF) ---
    
    compile: function (contentMap, rootUid) {
        if (!contentMap) return "";

        // Sắp xếp segment theo thứ tự tự nhiên (1.1, 1.2, 1.10...)
        const sortedKeys = Object.keys(contentMap).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        let html = '<article>';
        
        sortedKeys.forEach(segmentId => {
            const seg = contentMap[segmentId];
            const { pli, eng, html: htmlDecor } = seg;

            // Xử lý HTML Decorators (thẻ mở/đóng <p>, <h1>...)
            let openTag = "";
            let closeTag = "";
            
            if (htmlDecor) {
                // htmlDecor thường dạng "<p>{}" hoặc "{}</p>"
                const parts = htmlDecor.split("{}");
                if (parts.length === 2) {
                    openTag = parts[0];
                    closeTag = parts[1];
                }
            }

            // Xây dựng nội dung Segment
            // Thêm ID để Scroller có thể cuộn tới (neo)
            // Thêm class highlight để CSS xử lý
            let segmentHtml = `<span id="${segmentId}" class="segment">`;
            
            // Pali
            if (pli) {
                segmentHtml += `<span class="pli" lang="pi">${pli}</span>`;
            }
            
            // English
            if (eng) {
                segmentHtml += `<span class="eng" lang="en">${eng}</span>`;
            }
            
            segmentHtml += `</span>`; // End .segment

            // Ghép vào bài chính
            html += `${openTag}${segmentHtml}${closeTag}`;
        });

        html += '</article>';
        return html;
    },

    // --- 2. RENDER BRANCH STRUCTURE (MENU) ---

    compileBranch: function (structure, rootUid, metaMap) {
        if (!structure) return "";

        let html = `<div class="branch-container">`;
        
        // Helper: Duyệt cây đệ quy
        const buildTreeHtml = (node, depth = 0) => {
            let out = "";
            
            // Case A: List (Danh sách con)
            if (Array.isArray(node)) {
                out += `<ul class="branch-group depth-${depth}">`;
                node.forEach(child => {
                    out += buildTreeHtml(child, depth); // depth giữ nguyên hoặc tăng tùy logic CSS
                });
                out += `</ul>`;
            } 
            // Case B: Object (Node cha / Wrapper)
            else if (typeof node === 'object' && node !== null) {
                // Duyệt qua các keys (thường là ID của nhóm con)
                Object.keys(node).forEach(key => {
                    // Render bản thân key đó (như một header/link)
                    out += this._createCard(key, metaMap, "group");
                    // Render nội dung bên trong
                    out += buildTreeHtml(node[key], depth + 1);
                });
            } 
            // Case C: String (Leaf/Subleaf - ID bài kinh)
            else if (typeof node === 'string') {
                out += this._createCard(node, metaMap, "leaf");
            }
            
            return out;
        };

        // Bắt đầu duyệt từ root của structure
        // Structure thường có dạng: { "an": ["an1", "an2"] } hoặc { "an1": { ... } }
        // Ta muốn bỏ qua cái vỏ bọc rootUid ở cấp cao nhất nếu nó trùng với trang hiện tại
        let rootNode = structure;
        if (structure[rootUid]) {
            rootNode = structure[rootUid];
        }

        html += buildTreeHtml(rootNode);
        html += `</div>`;
        return html;
    },

    // Helper tạo thẻ Card/Link cho Menu
    _createCard: function (uid, metaMap, type) {
        const info = metaMap[uid] || {};
        const title = info.translated_title || info.original_title || uid;
        const acronym = info.acronym || uid.toUpperCase();
        const blurb = info.blurb ? `<div class="b-blurb">${info.blurb}</div>` : "";
        const cssClass = type === "group" ? "branch-card-group" : "branch-card-leaf";

        // Logic hiển thị Badge (Type)
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