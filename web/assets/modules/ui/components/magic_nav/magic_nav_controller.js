// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';
import { UIManager } from './ui_manager.js';
import { AppConfig } from '../../../core/app_config.js'; // [NEW] Import config

export const MagicNav = {
    _closeTimer: null,

    init() {
        const els = UIManager.init();
        if (!els.wrapper) return;

        // ... (Giữ nguyên các event listeners cũ) ...
        els.btnBreadcrumb.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleBreadcrumb();
        });
        els.btnToc.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleTOC();
        });
        els.backdrop.addEventListener("click", () => UIManager.closeAll());
        
        // [UPDATED] Sử dụng AppConfig cho timeout
        els.bar.addEventListener("mouseleave", () => {
            if (UIManager.isBreadcrumbExpanded()) {
                this._closeTimer = setTimeout(() => UIManager.closeAll(), AppConfig.MAGIC_NAV_COOLDOWN); 
            }
        });
        
        els.bar.addEventListener("mouseenter", () => {
            if (this._closeTimer) {
                clearTimeout(this._closeTimer);
                this._closeTimer = null;
            }
        });
    },

    toggleTOC() { UIManager.toggleTOC(); },

    // [NEW] Hàm xử lý Toggle Collapse/Expand cho TOC Node
    toggleNode(element) {
        // Tìm wrapper cha gần nhất (toc-node-wrapper)
        const wrapper = element.closest('.toc-node-wrapper');
        if (wrapper) {
            // Toggle class 'collapsed'
            wrapper.classList.toggle('collapsed');
            // Xoay icon (nếu có)
            const icon = wrapper.querySelector('.toc-toggle-icon svg');
            if (icon) {
                // Logic xoay sẽ được CSS xử lý dựa trên class .collapsed của wrapper
            }
        }
    },

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        // ... (Giữ nguyên logic tính toán path) ...
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
        const bcHtml = fullPath ? BreadcrumbRenderer.generateHtml(fullPath, finalMeta) : "";
        
        // [UPDATED] Render TOC với logic collapse mới
        const tocHtml = TocRenderer.render(localTree, currentUid, finalMeta, 0);
        UIManager.updateContent(bcHtml, tocHtml);
        UIManager.setHidden(!fullPath);
    }
};

window.MagicNav = MagicNav;