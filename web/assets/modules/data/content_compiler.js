// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
    /**
     * Biên dịch HTML cho bài kinh (Leaf).
     * Logic: Đơn giản, giữ nguyên cấu trúc cũ.
     */
    compile: function (contentData, rootId) {
        if (!contentData) return "";

        let html = "";
        
        // Sắp xếp keys
        const sortedKeys = Object.keys(contentData).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        );

        sortedKeys.forEach((segId) => {
            const seg = contentData[segId];
            if (!seg) return;

            // 1. Xây dựng nội dung bên trong (Pali + Anh + Comment)
            let contentInner = "";
            
            if (seg.pli) contentInner += `<span class='pli'>${seg.pli}</span>`;
            if (seg.eng) contentInner += `<span class='eng'>${seg.eng}</span>`;
            
            // [RESTORED] Khôi phục tính năng Comment (như bạn yêu cầu)
            if (seg.comm) {
                const safeComm = seg.comm.replace(/"/g, '&quot;').replace(/'/g, "&apos;");
                contentInner += `<span class='comment-marker' data-comment="${safeComm}">*</span>`;
            }

            // 2. Tạo HTML
            // - Nếu có template (html): Replace placeholder {}
            // - Nếu không (văn bản thường): Bọc trong <p class='segment'> và gán ID để scroll
            if (seg.html) {
                html += seg.html.replace("{}", contentInner);
            } else {
                html += `<p class='segment' id='${segId}'>${contentInner}</p>`;
            }
        });

        return html;
    },

    /**
     * Biên dịch HTML cho Mục lục (Branch).
     * Logic: Dùng thẻ <ul> <li> như file cũ bạn gửi.
     */
    compileBranch: function(structure, currentUid, metaMap) {
        // Helper tìm node trong cây (đệ quy xử lý cả Array và Object)
        function findNode(node, targetId) {
            if (!node) return null;
            
            // Trường hợp Array (Super Book hoặc Leaf List)
            if (Array.isArray(node)) {
                for (const item of node) {
                    // Nếu item là string (Leaf ID) -> Check match
                    if (typeof item === 'string' && item === targetId) return node; // Trả về chính mảng chứa nó
                    
                    // Nếu item là object (Branch con) -> Check key hoặc đệ quy
                    if (typeof item === 'object') {
                        if (item[targetId]) return item[targetId];
                        const res = findNode(item, targetId);
                        if (res) return res;
                    }
                }
                return null;
            } 
            
            // Trường hợp Object (Book Structure)
            if (typeof node === "object") {
                if (node[targetId]) return node[targetId];
                for (const key in node) {
                    if (key === 'meta' || typeof node[key] !== 'object') continue;
                    const res = findNode(node[key], targetId);
                    if (res) return res;
                }
            }
            return null;
        }

        const childrenNode = structure[currentUid] ? structure[currentUid] : findNode(structure, currentUid);

        if (!childrenNode) {
             return `<div class="error-message"><p>No items found.</p></div>`;
        }

        // Bắt đầu tạo HTML (Theo cấu trúc cũ: div > ul > li)
        let html = `<div class="branch-container"><ul>`;

        // Helper xử lý từng item
        const processItem = (childId) => {
            if (typeof childId !== 'string') return "";
            
            // Lấy thông tin từ metaMap (được truyền vào từ Renderer)
            const childMeta = metaMap[childId] || { };
            
            const title = childMeta.translated_title || childMeta.acronym || childId.toUpperCase();
            const subtitle = childMeta.original_title || ""; // Tên Pali
            const blurb = childMeta.blurb || "";
            const displayText = childMeta.acronym || childId.toUpperCase();
            
            // Xác định class CSS
            const type = childMeta.type || 'leaf';
            const cssClass = (type === "branch" || type === "root" || type === "group") 
                             ? "branch-card-group" 
                             : "branch-card-leaf";

            return `<li class="${cssClass}">
                        <a href="?q=${childId}" onclick="event.preventDefault(); window.loadSutta('${childId}', true);" class="b-card-link">
                            <div class="b-content">
                                <div class="b-header">
                                    <span class="b-title">${title}</span>
                                    ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ""}
                                </div>
                                ${blurb ? `<div class="b-blurb">${blurb}</div>` : ""} 
                                <div class="b-footer"><span class="b-badge">${displayText}</span></div>
                            </div>
                        </a>
                      </li>`;
        };

        // Duyệt danh sách con để render
        if (Array.isArray(childrenNode)) {
            childrenNode.forEach(item => {
                if (typeof item === 'string') {
                    html += processItem(item);
                } else if (typeof item === 'object') {
                    // Trường hợp mảng chứa object (Super struct) -> Lấy key của object
                    Object.keys(item).forEach(key => html += processItem(key));
                }
            });
        } else if (typeof childrenNode === "object") {
            Object.keys(childrenNode).forEach(key => html += processItem(key));
        }

        html += `</ul></div>`;
        return html;
    }
};