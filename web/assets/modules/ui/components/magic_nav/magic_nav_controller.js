// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';
import { UIManager } from './ui_manager.js';

export const MagicNav = {
    _closeTimer: null,

    init() {
        // Init UI Manager để lấy các element đã cache
        const els = UIManager.init();

        if (!els.wrapper) return;

        // --- BIND EVENTS ---

        // 1. Breadcrumb Button
        els.btnBreadcrumb.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleBreadcrumb();
        });

        // 2. TOC Button
        els.btnToc.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleTOC();
        });

        // 3. Close on Backdrop
        els.backdrop.addEventListener("click", () => UIManager.closeAll());

        // 4. Auto-collapse Logic (Mouse Leave)
        els.bar.addEventListener("mouseleave", () => {
            if (UIManager.isBreadcrumbExpanded()) {
                this._closeTimer = setTimeout(() => {
                    UIManager.closeAll();
                }, 2000); 
            }
        });

        // 5. Cancel Collapse (Mouse Enter)
        els.bar.addEventListener("mouseenter", () => {
            if (this._closeTimer) {
                clearTimeout(this._closeTimer);
                this._closeTimer = null;
            }
        });
    },

    // Public method gọi từ bên ngoài (ví dụ khi click link trong TOC)
    toggleTOC() {
        UIManager.toggleTOC();
    },

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        // 1. Calculate Path
        let fullPath = BreadcrumbRenderer.findPath(localTree, currentUid);
        
        // Merge Super Tree if needed
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

        // 2. Generate HTML
        const bcHtml = fullPath ? BreadcrumbRenderer.generateHtml(fullPath, finalMeta) : "";
        const tocHtml = TocRenderer.render(localTree, currentUid, finalMeta, 0);

        // 3. Update UI
        UIManager.updateContent(bcHtml, tocHtml);
        UIManager.setHidden(!fullPath); // Ẩn wrapper nếu không tìm thấy path
    }
};

// Expose global
window.MagicNav = MagicNav;