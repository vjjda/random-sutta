// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';

export const MagicNav = {
    _state: { tree: null, uid: null, meta: null },
    _closeTimer: null,

    init() {
        const btnBreadcrumb = document.getElementById("btn-magic-breadcrumb");
        const btnToc = document.getElementById("btn-magic-toc");
        const backdrop = document.getElementById("magic-backdrop");
        const breadcrumbBar = document.getElementById("magic-breadcrumb-bar");

        if (btnBreadcrumb) {
            btnBreadcrumb.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleBreadcrumb();
            });
        }

        if (breadcrumbBar) {
            breadcrumbBar.addEventListener("mouseleave", () => {
                if (breadcrumbBar.classList.contains("expanded")) {
                    this._closeTimer = setTimeout(() => {
                        this.closeAll();
                    }, 2000); 
                }
            });

            breadcrumbBar.addEventListener("mouseenter", () => {
                if (this._closeTimer) {
                    clearTimeout(this._closeTimer);
                    this._closeTimer = null;
                }
            });
        }

        if (btnToc) {
            btnToc.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleTOC();
            });
        }

        if (backdrop) {
            backdrop.addEventListener("click", () => this.closeAll());
        }
    },

    closeAll() {
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }

        document.getElementById("magic-breadcrumb-bar")?.classList.remove("expanded");
        document.getElementById("magic-toc-drawer")?.classList.remove("open");
        document.getElementById("magic-backdrop")?.classList.add("hidden");
        
        document.getElementById("btn-magic-toc")?.classList.remove("active");
        
        // [UPDATED] Xóa class open để xoay mũi tên lại
        const btnBc = document.getElementById("btn-magic-breadcrumb");
        btnBc?.classList.remove("active");
        btnBc?.classList.remove("open"); 
    },

    toggleBreadcrumb() {
        const bar = document.getElementById("magic-breadcrumb-bar");
        const btn = document.getElementById("btn-magic-breadcrumb");
        const isExpanded = bar.classList.contains("expanded");

        this.closeAll(); 

        if (!isExpanded) {
            bar.classList.add("expanded");
            btn.classList.add("active");
            // [UPDATED] Thêm class open để xoay icon
            btn.classList.add("open"); 
        }
    },

    toggleTOC() {
        const drawer = document.getElementById("magic-toc-drawer");
        const backdrop = document.getElementById("magic-backdrop");
        const btn = document.getElementById("btn-magic-toc");
        const isOpen = drawer.classList.contains("open");

        this.closeAll();

        if (!isOpen) {
            drawer.classList.add("open");
            backdrop.classList.remove("hidden");
            btn.classList.add("active");

            setTimeout(() => {
                const activeItem = drawer.querySelector(".toc-item.active") || drawer.querySelector(".toc-header.active");
                if (activeItem) {
                    // [UPDATED] Snappy scroll (Instant)
                    activeItem.scrollIntoView({ block: "center", behavior: "instant" });
                }
            }, 50); // Giảm timeout xuống chút cho nhanh
        }
    },

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        // ... (Giữ nguyên logic render cũ) ...
        const barContent = document.getElementById("magic-breadcrumb-bar");
        const tocContent = document.getElementById("magic-toc-content");
        const wrapper = document.getElementById("magic-nav-wrapper");

        if (!wrapper) return;

        let fullPath = BreadcrumbRenderer.findPath(localTree, currentUid);
        if (fullPath && superTree && fullPath.length > 0) {
            const rootBookId = fullPath[0]; 
            if (currentUid === rootBookId) {
                const superPath = BreadcrumbRenderer.findPath(superTree, rootBookId);
                if (superPath) {
                    superPath.pop(); 
                    fullPath = [...superPath, ...fullPath];
                }
            }
        }
        const finalMeta = { ...superMeta, ...contextMeta };

        if (fullPath && barContent) {
            barContent.innerHTML = BreadcrumbRenderer.generateHtml(fullPath, finalMeta);
            wrapper.classList.remove("hidden");
        } else {
            wrapper.classList.add("hidden");
        }

        if (tocContent) {
            tocContent.innerHTML = TocRenderer.render(localTree, currentUid, finalMeta, 0);
        }
    }
};

window.MagicNav = MagicNav;