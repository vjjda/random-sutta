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
        let localRootId = fullPath ? fullPath[0] : null;

        if (fullPath && superTree && fullPath.length > 0) {
            const rootBookId = fullPath[0]; // e.g., "an1" from ["an1", "an1.1-10", "an1.5"]
            
            // Find the path to this rootBookId within the superTree (e.g., ["tipitaka", "sutta", "an", "an1"])
            const superPath = BreadcrumbRenderer.findPath(superTree, rootBookId);
            
            if (superPath && superPath.length > 0) {
                // If the superPath's last element is the same as the localPath's first element,
                // remove it to avoid duplication when concatenating.
                // e.g., superPath ["...", "an1"] and fullPath ["an1", "..."]. Remove "an1" from superPath.
                if (superPath[superPath.length - 1] === rootBookId) {
                    superPath.pop(); 
                }
                fullPath = [...superPath, ...fullPath];
            }
        }
        const finalMeta = { ...superMeta, ...contextMeta };
        const bcHtml = fullPath ? BreadcrumbRenderer.generateHtml(fullPath, finalMeta, localRootId) : "";
        
        // [UPDATED] Render TOC với logic collapse mới
        const tocHtml = TocRenderer.render(localTree, currentUid, finalMeta, 0);
        UIManager.updateContent(bcHtml, tocHtml);
        UIManager.setHidden(!fullPath);
    }
};

window.MagicNav = MagicNav;