// Path: web/assets/modules/ui/components/magic_nav/magic_nav_controller.js
import { BreadcrumbRenderer } from './breadcrumb_renderer.js';
import { TocRenderer } from './toc_renderer.js';
import { UIManager } from './ui_manager.js';
import { AppConfig } from '../../../core/app_config.js';

export const MagicNav = {
    _closeTimer: null,

    init() {
        const els = UIManager.init();
        if (!els.wrapper) return;

        els.btnToc.addEventListener("click", (e) => {
            e.stopPropagation();
            UIManager.toggleTOC();
        });
        els.backdrop.addEventListener("click", () => UIManager.closeAll());
        
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
    
    // [NEW] Thêm hàm này để Renderer gọi được
    closeAll() { UIManager.closeAll(); },

    toggleNode(element) {
        const wrapper = element.closest('.toc-node-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('collapsed');
            const icon = wrapper.querySelector('.toc-toggle-icon svg');
            if (icon) {
            }
        }
    },

    render(localTree, currentUid, contextMeta, superTree, superMeta) {
        let fullPath = BreadcrumbRenderer.findPath(localTree, currentUid);
        let localRootId = fullPath ? fullPath[0] : null;
        
        // Cây dùng để tra cứu cấu trúc (ưu tiên superTree nếu có để nhìn được toàn cảnh)
        let structureForLookup = localTree; 

        if (fullPath && superTree && fullPath.length > 0) {
            const rootBookId = fullPath[0];
            const superPath = BreadcrumbRenderer.findPath(superTree, rootBookId);
            if (superPath && superPath.length > 0) {
                if (superPath[superPath.length - 1] === rootBookId) {
                    superPath.pop();
                }
                fullPath = [...superPath, ...fullPath];
            }
            structureForLookup = superTree; // Dùng SuperTree để check single-chain
        }
        const finalMeta = { ...superMeta, ...contextMeta };
        
        // [UPDATED] Truyền structureForLookup vào tham số thứ 4
        const bcHtml = fullPath ? BreadcrumbRenderer.generateHtml(fullPath, finalMeta, localRootId, structureForLookup) : "";
        
        const tocHtml = TocRenderer.render(localTree, currentUid, finalMeta, 0);
        UIManager.updateContent(bcHtml, tocHtml);
        UIManager.setHidden(!fullPath);
    }
};

window.MagicNav = MagicNav;