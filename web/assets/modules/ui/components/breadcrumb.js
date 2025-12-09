// Path: web/assets/modules/ui/components/breadcrumb.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Breadcrumb");

export const Breadcrumb = {
    /**
     * Tìm đường dẫn từ gốc cây đến targetUid
     * @returns {Array} List of nodes [{uid, type}]
     */
    _findPath(structure, targetUid, currentPath = []) {
        // 1. Kiểm tra Node hiện tại (String = Leaf)
        if (typeof structure === 'string') {
            return structure === targetUid ? [...currentPath, structure] : null;
        }

        // 2. Kiểm tra Array (Container)
        if (Array.isArray(structure)) {
            for (const child of structure) {
                const result = this._findPath(child, targetUid, currentPath);
                if (result) return result;
            }
            return null;
        }

        // 3. Kiểm tra Object (Branch/Group)
        if (typeof structure === 'object' && structure !== null) {
            for (const key in structure) {
                // Thêm key (Branch ID) vào path và đi sâu xuống
                const newPath = [...currentPath, key];
                const result = this._findPath(structure[key], targetUid, newPath);
                if (result) return result;
            }
        }

        return null;
    },

    /**
     * Tạo HTML cho Breadcrumb
     */
    generateHtml(path, metaMap) {
        if (!path || path.length === 0) return "";

        let html = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>`;
        
        // Luôn thêm nút Home/Root
        html += `<li><button onclick="window.location.href='index.html'" class="bc-link">Home</button></li>`;
        html += `<li class="bc-separator">/</li>`;

        path.forEach((uid, index) => {
            const isLast = index === path.length - 1;
            const meta = metaMap[uid] || {};
            
            // Ưu tiên Acronym -> Translated Title -> UID
            let label = meta.acronym || meta.translated_title || uid.toUpperCase();
            
            if (isLast) {
                html += `<li class="bc-item active" aria-current="page">${label}</li>`;
            } else {
                // Nếu là Branch (Folder), có thể chưa hỗ trợ click để view list (tùy logic app)
                // Hiện tại cứ để text hoặc link reload với ?q=uid
                html += `<li><button onclick="window.loadSutta('${uid}')" class="bc-link">${label}</button></li>`;
                html += `<li class="bc-separator">/</li>`;
            }
        });

        html += `</ol></nav>`;
        return html;
    },

    /**
     * Render vào DOM
     */
    render(containerId, bookStructure, currentUid, contextMeta) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 1. Tính toán đường dẫn
        const path = this._findPath(bookStructure, currentUid);
        
        if (!path) {
            container.innerHTML = "";
            return;
        }

        // 2. Tạo HTML
        const html = this.generateHtml(path, contextMeta);
        
        // 3. Inject
        container.innerHTML = html;
        container.classList.remove("hidden");
    }
};