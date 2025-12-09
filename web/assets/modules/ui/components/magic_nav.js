// Path: web/assets/modules/ui/components/magic_nav.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("MagicNav");

export const MagicNav = {
    _clickTimer: null,
    _state: { tree: null, uid: null, meta: null },

    init() {
        const wrapper = document.getElementById("magic-nav-wrapper");
        const dot = document.getElementById("magic-dot");
        const backdrop = document.getElementById("magic-backdrop");

        if (!wrapper || !dot) return;

        // --- HANDLER: CLICK & DOUBLE CLICK ---
        const handleClick = (e) => {
            // Ngăn chặn các hành vi mặc định nếu cần
            // e.preventDefault(); 

            if (this._clickTimer) {
                // --- DOUBLE CLICK DETECTED ---
                clearTimeout(this._clickTimer);
                this._clickTimer = null;
                
                // Action: Open TOC
                this._openTOC();
            } else {
                // --- FIRST CLICK ---
                this._clickTimer = setTimeout(() => {
                    this._clickTimer = null;
                    
                    // Action: Toggle Breadcrumb (Single Click)
                    const breadcrumbBar = document.getElementById("magic-breadcrumb");
                    if (breadcrumbBar.classList.contains("expanded")) {
                        this._collapseAll();
                    } else {
                        this._openBreadcrumb();
                    }
                }, 250); // Delay 250ms để chờ cú click thứ 2
            }
        };

        // Chỉ cần bắt sự kiện 'click' là đủ cho cả Mouse và Touch
        // (Trình duyệt mobile hiện đại xử lý click rất tốt nếu có touch-action: manipulation)
        dot.addEventListener("click", handleClick);

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
        
        // Tự động đóng sau 10s nếu không dùng
        // setTimeout(() => this._collapseAll(), 10000);
    },

    _openTOC() {
        this._collapseAll(); // Reset trạng thái trước khi mở
        
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

    // --- RENDER LOGIC (Giữ nguyên không đổi) ---

    _renderBreadcrumbHtml(path, metaMap) {
        let html = `<ol>`;
        path.forEach((uid, index) => {
            const isLast = index === path.length - 1;
            const meta = metaMap[uid] || {};
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
        const createItem = (id) => {
            const meta = metaMap[id] || {};
            const label = meta.acronym || meta.original_title || id.toUpperCase();
            const isActive = id === currentUid ? "active" : "";
            const action = isActive ? "" : `onclick="window.loadSutta('${id}'); MagicNav._collapseAll()"`;
            
            return `<div class="toc-item ${isActive}" ${action}>
                        <span class="toc-label">${label}</span>
                        ${meta.translated_title ? `<span class="toc-sub">${meta.translated_title}</span>` : ''}
                    </div>`;
        };

        if (typeof node === 'string') {
            return createItem(node);
        } else if (Array.isArray(node)) {
            html += `<div class="toc-group">`;
            node.forEach(child => {
                html += this._renderTocRecursive(child, currentUid, metaMap);
            });
            html += `</div>`;
        } else if (typeof node === 'object' && node !== null) {
            for (const key in node) {
                html += `<div class="toc-branch">`;
                html += this._renderTocRecursive(node[key], currentUid, metaMap);
                html += `</div>`;
            }
        }
        return html;
    },

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

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        this._state = { tree: localTree, uid: currentUid, meta: contextMeta };
        
        const breadcrumbBar = document.getElementById("magic-breadcrumb");
        const tocContent = document.getElementById("magic-toc-content");
        const wrapper = document.getElementById("magic-nav-wrapper");

        if (!breadcrumbBar || !wrapper) return;

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

        if (fullPath) {
            breadcrumbBar.innerHTML = this._renderBreadcrumbHtml(fullPath, finalMeta);
            wrapper.classList.remove("hidden");
        } else {
            wrapper.classList.add("hidden");
        }

        if (tocContent) {
            tocContent.innerHTML = this._renderTocRecursive(localTree, currentUid, finalMeta);
        }
    }
};

window.MagicNav = MagicNav;