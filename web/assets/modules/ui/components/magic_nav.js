// Path: web/assets/modules/ui/components/magic_nav.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("MagicNav");

export const MagicNav = {
    _longPressTimer: null,
    _isLongPress: false,
    _state: { tree: null, uid: null, meta: null },

    init() {
        const wrapper = document.getElementById("magic-nav-wrapper");
        const dot = document.getElementById("magic-dot");
        const breadcrumbBar = document.getElementById("magic-breadcrumb");
        const tocDrawer = document.getElementById("magic-toc");
        const backdrop = document.getElementById("magic-backdrop");

        if (!wrapper || !dot) return;

        // --- HANDLER: CLICK VS LONG PRESS ---
        const startPress = (e) => {
            // Chỉ xử lý chuột trái hoặc touch đơn
            if (e.type === 'mousedown' && e.button !== 0) return;
            
            this._isLongPress = false;
            this._longPressTimer = setTimeout(() => {
                this._isLongPress = true;
                this._openTOC(); // LONG PRESS ACTION
                // Rung nhẹ trên mobile nếu hỗ trợ
                if (navigator.vibrate) navigator.vibrate(50);
            }, 600); // 600ms = Long press
        };

        const endPress = (e) => {
            if (this._longPressTimer) {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            }

            if (!this._isLongPress) {
                // Đây là CLICK ACTION
                // Toggle giữa Dot và Breadcrumb Bar
                if (breadcrumbBar.classList.contains("expanded")) {
                    this._collapseAll();
                } else {
                    this._openBreadcrumb();
                }
            }
            // Reset flag
            this._isLongPress = false;
        };

        // Mouse Events
        dot.addEventListener("mousedown", startPress);
        dot.addEventListener("mouseup", endPress);
        dot.addEventListener("mouseleave", endPress); // Kéo chuột ra ngoài thì hủy

        // Touch Events (Mobile)
        dot.addEventListener("touchstart", startPress, { passive: true });
        dot.addEventListener("touchend", endPress);

        // Click Backdrop để đóng
        backdrop.addEventListener("click", () => this._collapseAll());
    },

    _collapseAll() {
        document.getElementById("magic-breadcrumb").classList.remove("expanded");
        document.getElementById("magic-toc").classList.remove("open");
        document.getElementById("magic-backdrop").classList.add("hidden");
        document.getElementById("magic-dot").classList.remove("active");
    },

    _openBreadcrumb() {
        const bar = document.getElementById("magic-breadcrumb");
        bar.classList.add("expanded");
        // Tự động đóng sau 5s nếu không tương tác (Optional, cho gọn)
        // setTimeout(() => bar.classList.remove("expanded"), 5000);
    },

    _openTOC() {
        this._collapseAll(); // Đóng breadcrumb nếu đang mở
        
        const drawer = document.getElementById("magic-toc");
        const backdrop = document.getElementById("magic-backdrop");
        const dot = document.getElementById("magic-dot");

        drawer.classList.add("open");
        backdrop.classList.remove("hidden");
        dot.classList.add("active");

        // Scroll active item vào giữa
        setTimeout(() => {
            const activeItem = drawer.querySelector(".toc-item.active");
            if (activeItem) {
                activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
            }
        }, 100);
    },

    // --- RENDER LOGIC ---

    _renderBreadcrumbHtml(path, metaMap) {
        let html = `<ol>`;
        path.forEach((uid, index) => {
            const isLast = index === path.length - 1;
            const meta = metaMap[uid] || {};
            // Ưu tiên: Acronym -> Original -> UID
            let label = meta.acronym || meta.original_title || uid.toUpperCase();
            
            if (index > 0) html += `<li class="bc-sep">/</li>`;
            
            if (isLast) {
                html += `<li class="bc-item active">${label}</li>`;
            } else {
                html += `<li><button onclick="window.loadSutta('${uid}')" class="bc-link">${label}</button></li>`;
            }
        });
        html += `</ol>`;
        return html;
    },

    _renderTocRecursive(node, currentUid, metaMap) {
        let html = ``;
        
        // Helper: Render 1 item
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const label = meta.acronym || meta.original_title || id.toUpperCase();
            const isActive = id === currentUid ? "active" : "";
            // Nếu là active item thì không click được (đang xem rồi)
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav._collapseAll()"`;
            
            return `<div class="toc-item ${isActive}" ${action}>
                        <span class="toc-label">${label}</span>
                        ${meta.translated_title ? `<span class="toc-sub">${meta.translated_title}</span>` : ''}
                    </div>`;
        };

        if (typeof node === 'string') {
            return createItem(node);
        } else if (Array.isArray(node)) {
            // Mảng con -> List
            html += `<div class="toc-group">`;
            node.forEach(child => {
                html += this._renderTocRecursive(child, currentUid, metaMap);
            });
            html += `</div>`;
        } else if (typeof node === 'object' && node !== null) {
            // Object -> Branch
            for (const key in node) {
                html += `<div class="toc-branch">`;
                // Render tiêu đề branch (nếu cần thiết, hoặc chỉ render con)
                // Ở đây ta render con thôi cho phẳng
                html += this._renderTocRecursive(node[key], currentUid, metaMap);
                html += `</div>`;
            }
        }
        return html;
    },

    _findPath(structure, targetUid, currentPath = []) {
        // ... (Giữ nguyên logic DFS cũ từ Breadcrumb.js) ...
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

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        this._state = { tree: localTree, uid: currentUid, meta: contextMeta };
        
        const breadcrumbBar = document.getElementById("magic-breadcrumb");
        const tocContent = document.getElementById("magic-toc-content");
        const wrapper = document.getElementById("magic-nav-wrapper");

        if (!breadcrumbBar || !wrapper) return;

        // 1. Prepare Data
        let fullPath = this._findPath(localTree, currentUid);
        if (fullPath && superTree && fullPath.length > 0) {
            const rootBookId = fullPath[0]; 
            if (currentUid === rootBookId) {
                const superPath = this._findPath(superTree, rootBookId);
                if (superPath) {
                    superPath.pop(); 
                    fullPath = [...superPath, ...fullPath];
                }
            }
        }
        const finalMeta = { ...superMeta, ...contextMeta };

        // 2. Render Breadcrumb Bar
        if (fullPath) {
            breadcrumbBar.innerHTML = this._renderBreadcrumbHtml(fullPath, finalMeta);
            wrapper.classList.remove("hidden");
        } else {
            wrapper.classList.add("hidden");
        }

        // 3. Render TOC (Pre-render sẵn để mở cho nhanh)
        if (tocContent) {
            tocContent.innerHTML = this._renderTocRecursive(localTree, currentUid, finalMeta);
        }
    }
};

// Expose để gọi từ HTML onclick
window.MagicNav = MagicNav;