// Path: web/assets/modules/ui/components/popup/controllers/quicklook_controller.js
import { PopupState } from '../state/popup_state.js';
import { QuicklookUI } from '../ui/quicklook_ui.js';
import { NavigationController } from './navigation_controller.js';
import { SuttaService } from 'services/sutta_service.js';
import { LeafRenderer } from 'ui/views/renderers/leaf_renderer.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("QuicklookCtrl");
const SCROLL_OFFSET = 60;

export const QuicklookController = {
    init() {
        QuicklookUI.init({
            onClose: () => {
                QuicklookUI.hide();
                // Revert state về Comment nếu có
                if (PopupState.activeIndex !== -1) {
                    PopupState.activeType = 'comment';
                    PopupState.activeUrl = null;
                } else {
                    window.dispatchEvent(new CustomEvent('popup:close-all'));
                }
            },
            onDeepLink: (href) => {
                NavigationController.navigateToMain(href, () => window.dispatchEvent(new CustomEvent('popup:close-all')));
            },
            onOpenOriginal: (href) => {
                NavigationController.handleFullPageNavigation(href, () => window.dispatchEvent(new CustomEvent('popup:close-all')));
            }
        });
    },

    async handleLinkRequest(href, isRestoring = false) {
        const parsed = NavigationController.parseUrl(href);
        if (!parsed) return;
        const { uid, hash } = parsed;

        if (PopupState.loadingUid === uid) return;
        PopupState.loadingUid = uid;

        // [UX] Show immediately
        QuicklookUI.showLoading(uid.toUpperCase());

        try {
            const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
            
            if (data && data.content) {
                const renderRes = LeafRenderer.render(data);
                const displayTitle = this._buildTitle(data.meta, uid);
                
                QuicklookUI.render(renderRes.html, displayTitle, href);
                
                // Update State
                PopupState.setQuicklookActive(href);

                if (hash) {
                    this._scrollToAnchor(hash, uid);
                }
            } else {
                QuicklookUI.showError("Content not available.");
            }
        } catch (e) {
            logger.error("Load", e);
            QuicklookUI.showError("Failed to load.");
        } finally {
            PopupState.loadingUid = null;
        }
    },

    _scrollToAnchor(hash, uid) {
        let targetId = hash.substring(1);
        if (targetId && !targetId.includes(':') && /^[\d\.]+$/.test(targetId)) {
            targetId = `${uid}:${targetId}`;
        }

        setTimeout(() => {
            const qBody = QuicklookUI.elements.popupBody;
            const targetEl = qBody?.querySelector(`[id="${targetId}"]`);

            if (targetEl && qBody) {
                const containerRect = qBody.getBoundingClientRect();
                const elementRect = targetEl.getBoundingClientRect();
                const currentScroll = qBody.scrollTop;
                const targetPosition = currentScroll + (elementRect.top - containerRect.top) - SCROLL_OFFSET;

                qBody.scrollTop = targetPosition;

                qBody.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                targetEl.classList.add('highlight');
            }
        }, 100);
    },

    _buildTitle(meta, uid) {
        meta = meta || {};
        const acronym = meta.acronym || uid.toUpperCase();
        const title = meta.translated_title || meta.original_title || "";
        if (title) return `<span class="ql-uid-badge">${acronym}</span><span class="ql-sutta-title">${title}</span>`;
        return `<span class="ql-uid-badge">${acronym}</span>`;
    }
};