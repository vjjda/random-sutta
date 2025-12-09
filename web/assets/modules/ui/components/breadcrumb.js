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
                // Nếu chính Key là target (trường hợp Branch/Folder), trả về luôn
                if (key === targetUid) return newPath;
                
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
            
            // Priority: Acronym > Original Title > UID
            // [NOTE] Loại bỏ chữ "Tipitaka" (tpk) nếu muốn gọn hơn, hoặc giữ lại tùy ý.
            // Ở đây tôi giữ lại để người dùng biết gốc rễ.
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
     * [UPDATED] Hỗ trợ Super Tree (Tipitaka Context)
     */
    render(containerId, localTree, currentUid, contextMeta, superTree = null, superMeta = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 1. Tìm đường dẫn nội bộ (Local Path)
        // Ví dụ: MN -> MN 1
        let fullPath = this._findPath(localTree, currentUid);
        
        // 2. Nếu có Super Tree, tìm đường dẫn từ gốc Tipitaka đến sách hiện tại
        if (fullPath && superTree && fullPath.length > 0) {
            const rootBookId = fullPath[0]; // Node đầu tiên của local tree (ví dụ: 'mn')
            
            // Tìm 'mn' nằm ở đâu trong 'tpk'
            // Ví dụ: ['tpk', 'sutta', 'mn']
            const superPath = this._findPath(superTree, rootBookId);
            
            if (superPath) {
                // Nối 2 đường dẫn lại
                // Super: [tpk, sutta, mn]
                // Local: [mn, mn1]
                // Kết quả: [tpk, sutta, mn, mn1] (Cần loại bỏ phần tử trùng ở khớp nối)
                
                // Loại bỏ node cuối của superPath vì nó trùng với node đầu của fullPath
                superPath.pop(); 
                fullPath = [...superPath, ...fullPath];
            }
        }

        if (!fullPath) {
            container.innerHTML = "";
            return;
        }

        // 3. Merge Meta để hiển thị tên đúng
        const finalMeta = { ...superMeta, ...contextMeta };

        const html = this.generateHtml(fullPath, finalMeta);
        
        container.innerHTML = html;
        container.classList.remove("hidden");
    }
};