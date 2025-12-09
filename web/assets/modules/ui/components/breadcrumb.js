// Path: web/assets/modules/ui/components/breadcrumb.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("Breadcrumb");

export const Breadcrumb = {
    // ... (Giữ nguyên hàm _findPath) ...
    _findPath(structure, targetUid, currentPath = []) {
        if (!structure) return null;
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
                if (key === targetUid) return newPath;
                const result = this._findPath(structure[key], targetUid, newPath);
                if (result) return result;
            }
        }
        return null;
    },

    // ... (Giữ nguyên hàm generateHtml) ...
    generateHtml(path, metaMap) {
        if (!path || path.length === 0) return "";

        let html = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>`;
        
        path.forEach((uid, index) => {
            const isLast = index === path.length - 1;
            const meta = metaMap[uid] || {};
            let label = meta.acronym || meta.original_title || uid.toUpperCase();
            
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

    /**
     * Render với logic hiển thị thông minh
     */
    render(containerId, localTree, currentUid, contextMeta, superTree = null, superMeta = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 1. Tìm đường dẫn nội bộ (Local Path)
        // Ví dụ: MN -> MN 1
        let fullPath = this._findPath(localTree, currentUid);
        
        if (!fullPath || fullPath.length === 0) {
            container.innerHTML = "";
            return;
        }

        // [LOGIC CHANGE] Chỉ nối với Super Tree (Tipitaka) nếu UID hiện tại là Gốc (Root) của sách
        // - Nếu xem 'mn' (Root) -> fullPath=['mn'] -> Nối -> Tipitaka > Sutta > MN
        // - Nếu xem 'mn1' (Node) -> fullPath=['mn', 'mn1'] -> Không nối -> MN > MN 1
        
        const rootBookId = fullPath[0]; // Node gốc của cây hiện tại
        
        if (currentUid === rootBookId && superTree) {
            const superPath = this._findPath(superTree, rootBookId);
            
            if (superPath) {
                superPath.pop(); // Bỏ node trùng
                fullPath = [...superPath, ...fullPath];
            }
        }

        // 3. Merge Meta
        const finalMeta = { ...superMeta, ...contextMeta };

        const html = this.generateHtml(fullPath, finalMeta);
        
        container.innerHTML = html;
        container.classList.remove("hidden");
    }
};