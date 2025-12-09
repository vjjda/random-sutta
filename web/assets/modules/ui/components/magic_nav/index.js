// Path: web/assets/modules/ui/components/magic_nav/index.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';

export const MagicNav = {
    _state: { tree: null, uid: null, meta: null },

    init() {
        const btnBreadcrumb = document.getElementById("btn-magic-breadcrumb");
        const btnToc = document.getElementById("btn-magic-toc");
        const backdrop = document.getElementById("magic-backdrop");

        if (btnBreadcrumb) {
            btnBreadcrumb.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleBreadcrumb();
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
        document.getElementById("magic-breadcrumb-bar")?.classList.remove("expanded");
        document.getElementById("magic-toc-drawer")?.classList.remove("open");
        document.getElementById("magic-backdrop")?.classList.add("hidden");
        
        // Reset button states
        document.getElementById("btn-magic-toc")?.classList.remove("active");
        document.getElementById("btn-magic-breadcrumb")?.classList.remove("active");
    },

    toggleBreadcrumb() {
        const bar = document.getElementById("magic-breadcrumb-bar");
        const btn = document.getElementById("btn-magic-breadcrumb");
        const isExpanded = bar.classList.contains("expanded");

        this.closeAll(); // Close others first

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

        this.closeAll(); // Close others first

        if (!isOpen) {
            drawer.classList.add("open");
            backdrop.classList.remove("hidden");
            btn.classList.add("active");

            // Auto scroll to active item
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

        // 1. Breadcrumb Logic
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

        // 2. TOC Logic
        if (tocContent) {
            tocContent.innerHTML = TocRenderer.render(localTree, currentUid, finalMeta);
        }
    }
};

// Expose global for onclick handlers in HTML string
window.MagicNav = MagicNav;