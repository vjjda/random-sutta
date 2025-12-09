// Path: web/assets/modules/ui/components/breadcrumb.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Breadcrumb");

export const Breadcrumb = {
    // ... (Giữ nguyên hàm _findPath) ...
    _findPath(structure, targetUid, currentPath = []) {
        if (typeof structure === 'string') {
            return structure === targetUid ? [...currentPath, structure] : null;
        }
        if (Array.isArray(structure)) {
            for (const child of structure) {
                const result = this._findPath(child, targetUid, currentPath);
                if (result) return result;
            }
            return null;
        }
        if (typeof structure === 'object' && structure !== null) {
            for (const key in structure) {
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
        
        path.forEach((uid, index) => {
            const isLast = index === path.length - 1;
            const meta = metaMap[uid] || {};
            
            // [CHANGED] Thứ tự ưu tiên: Acronym > Original Title > UID
            let label = meta.acronym || meta.original_title || uid.toUpperCase();
            
            // Thêm dấu ngăn cách nếu không phải item đầu tiên
            if (index > 0) {
                html += `<li class="bc-separator">/</li>`;
            }

            if (isLast) {
                html += `<li class="bc-item active" aria-current="page">${label}</li>`;
            } else {
                html += `<li><button onclick="window.loadSutta('${uid}')" class="bc-link">${label}</button></li>`;
            }
        });

        html += `</ol></nav>`;
        return html;
    },

    // ... (Giữ nguyên hàm render) ...
    render(containerId, bookStructure, currentUid, contextMeta) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const path = this._findPath(bookStructure, currentUid);
        
        if (!path) {
            container.innerHTML = "";
            return;
        }

        const html = this.generateHtml(path, contextMeta);
        
        container.innerHTML = html;
        container.classList.remove("hidden");
    }
};