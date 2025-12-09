// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';

export const MagicNav = {
    _state: { tree: null, uid: null, meta: null },
    _closeTimer: null, // [NEW] Timer quản lý tự đóng

    init() {
        const btnBreadcrumb = document.getElementById("btn-magic-breadcrumb");
        const btnToc = document.getElementById("btn-magic-toc");
        const backdrop = document.getElementById("magic-backdrop");
        const breadcrumbBar = document.getElementById("magic-breadcrumb-bar"); // [NEW]

        if (btnBreadcrumb) {
            btnBreadcrumb.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleBreadcrumb();
            });
        }

        // [NEW] Logic Auto-collapse cho Breadcrumb Bar
        if (breadcrumbBar) {
            // Khi chuột rời đi: Đếm ngược 2s rồi đóng
            breadcrumbBar.addEventListener("mouseleave", () => {
                if (breadcrumbBar.classList.contains("expanded")) {
                    this._closeTimer = setTimeout(() => {
                        this.closeAll();
                    }, 2000); // 2 giây
                }
            });

            // Khi chuột quay lại: Hủy đếm ngược (giữ mở)
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
        // Clear timer nếu có
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }

        document.getElementById("magic-breadcrumb-bar")?.classList.remove("expanded");
        document.getElementById("magic-toc-drawer")?.classList.remove("open");
        document.getElementById("magic-backdrop")?.classList.add("hidden");
        
        document.getElementById("btn-magic-toc")?.classList.remove("active");
        document.getElementById("btn-magic-breadcrumb")?.classList.remove("active");
    },

    // ... (Giữ nguyên các hàm toggleBreadcrumb, toggleTOC, render) ...
    toggleBreadcrumb() {
        const bar = document.getElementById("magic-breadcrumb-bar");
        const btn = document.getElementById("btn-magic-breadcrumb");
        const isExpanded = bar.classList.contains("expanded");

        this.closeAll(); 

        if (!isExpanded) {
            bar.classList.add("expanded");
            btn.classList.add("active");
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
                const activeItem = drawer.querySelector(".toc-item.active");
                if (activeItem) {
                    activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            }, 100);
        }
    },

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
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
            // Pass level 0
            tocContent.innerHTML = TocRenderer.render(localTree, currentUid, finalMeta, 0);
        }
    }
};

window.MagicNav = MagicNav;