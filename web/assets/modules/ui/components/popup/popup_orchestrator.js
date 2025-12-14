// Path: web/assets/modules/ui/components/popup/popup_orchestrator.js
import { CommentPopupUI } from './comment_popup_ui.js';
import { QuicklookPopupUI } from './quicklook_popup_ui.js';
import { PopupState } from './popup_state.js';
import { PopupScanner } from './popup_scanner.js';

import { Scroller } from 'ui/common/scroller.js';
import { getLogger } from 'utils/logger.js';
import { SuttaService } from 'services/sutta_service.js';
import { LeafRenderer } from 'ui/views/renderers/leaf_renderer.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("PopupOrchestrator");
const QUICKLOOK_SCROLL_OFFSET = 60;

export const PopupOrchestrator = {
    init() {
        this._applyLayoutConfig();

        CommentPopupUI.init({
            onClose: () => this.closeAll(),
            onNavigate: (dir) => this._navigateComment(dir),
            onLinkClick: (href) => this._handleLinkRequest(href)
        });

        QuicklookPopupUI.init({
            onClose: () => {
                // Khi đóng Quicklook bằng nút X, ta đóng Quicklook 
                // nhưng nếu bên dưới có Comment thì Comment sẽ hiện ra (State logic)
                QuicklookPopupUI.hide();
                // Nếu đang có comment active, state tự quay về comment (do Quicklook chỉ là layer trên)
                // Tuy nhiên để đơn giản, ta close all hoặc check logic sâu hơn.
                // Ở đây chọn giải pháp an toàn: Close All để đồng bộ state.
                this.closeAll(); 
            },
            onDeepLink: (href) => this._navigateToMain(href),
            onOpenOriginal: (href) => this._handleFullPageNavigation(href)
        });

        this._bindGlobalEvents();
    },

    // --- RESTORATION LOGIC (UNIFIED) ---

    restoreState() {
        const snapshot = PopupState.getSnapshot();
        if (!snapshot || snapshot.type === 'none') return;

        logger.info("Restore", `Restoring Type: ${snapshot.type}`);

        // CASE 1: COMMENT
        if (snapshot.type === 'comment' && snapshot.data) {
            const idx = snapshot.data.index;
            if (!PopupState.hasComments()) {
                const list = PopupScanner.scan("sutta-container");
                PopupState.setComments(list);
            }
            if (PopupState.hasComments() && idx >= 0 && idx < PopupState.comments.length) {
                this._activateComment(idx);
                // Scroll main view
                const item = PopupState.comments[idx];
                if (item && item.id) Scroller.scrollToId(item.id, 'instant');
            }
        }
        
        // CASE 2: QUICKLOOK
        else if (snapshot.type === 'quicklook' && snapshot.data) {
            const url = snapshot.data.url;
            if (url) {
                // Gọi với cờ isRestoring = true
                this._handleLinkRequest(url, true);
            }
        }
    },

    // --- NAVIGATION HANDLERS ---

    _handleFullPageNavigation(href) {
        // 1. Lưu state hiện tại (đang nằm trong RAM của PopupState) vào History
        PopupState.saveSnapshot();
        // 2. Chuyển trang
        this._navigateToMain(href);
    },

    _navigateToMain(href) {
        this.closeAll();
        const parsed = this._parseUrl(href);
        if (parsed) {
            let loadId = parsed.uid;
            if (parsed.hash) loadId += parsed.hash;
            window.loadSutta(loadId, true, 0, { transition: false });
        }
    },

    // --- CORE ACTIONS ---

    closeAll() {
        CommentPopupUI.hide();
        QuicklookPopupUI.hide();
        PopupState.loadingUid = null;
        PopupState.clearActive(); // Xóa state
    },

    // 1. Comment Actions
    _openCommentByText(text) {
        if (!PopupState.hasComments()) this.scanComments();
        const index = PopupState.comments.findIndex(c => c.text === text);
        if (index !== -1) {
            this._activateComment(index);
            QuicklookPopupUI.hide();
        }
    },

    _activateComment(index) {
        // Update State
        PopupState.setCommentActive(index);
        
        // Update UI
        const total = PopupState.comments.length;
        const item = PopupState.comments[index];
        const context = PopupScanner.getContextText(PopupState.comments, index);
        CommentPopupUI.render(item.text, index, total, context);
    },

    _navigateComment(dir) {
        // Lấy index từ state hiện tại (hoặc từ biến local cũ nếu chưa refactor hết, nhưng nên dùng state)
        // Lưu ý: PopupState.activePopup.data.index có thể chưa đồng bộ nếu ta dùng biến currentIndex cũ.
        // Để an toàn, ta dùng currentIndex cũ trong PopupState (đã refactor ở file state).
        // Check lại popup_state.js: ta chưa expose currentIndex getter.
        // Sửa nhanh: Ta sẽ dựa vào logic cũ: activePopup.data.index
        
        const currentData = PopupState.activePopup.data;
        let currentIdx = (currentData && typeof currentData.index === 'number') ? currentData.index : -1;
        
        const nextIdx = currentIdx + dir;
        if (nextIdx >= 0 && nextIdx < PopupState.comments.length) {
            this._activateComment(nextIdx);
            
            const item = PopupState.comments[nextIdx];
            if (item.id) Scroller.scrollToId(item.id, 'smooth');
            
            QuicklookPopupUI.hide();
        }
    },

    scanComments() {
        const list = PopupScanner.scan("sutta-container");
        PopupState.setComments(list);
    },

    // 2. Quicklook Actions
    async _handleLinkRequest(href, isRestoring = false) {
        const parsed = this._parseUrl(href);
        if (!parsed) return;
        const { uid, hash } = parsed;

        if (PopupState.loadingUid === uid) return;
        PopupState.loadingUid = uid;

        // [UX] Show loading immediately
        QuicklookPopupUI.showLoading(uid.toUpperCase());

        try {
            const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
            
            if (data && data.content) {
                const renderRes = LeafRenderer.render(data);
                const displayTitle = this._buildQuicklookTitle(data.meta, uid);
                
                QuicklookPopupUI.render(renderRes.html, displayTitle, href);
                
                // Update State thành Quicklook (Lưu URL)
                PopupState.setQuicklookActive(href);

                if (hash) {
                    this._scrollToQuicklookAnchor(hash, uid);
                }
            } else {
                QuicklookPopupUI.showError("Content not available.");
            }
        } catch (e) {
            logger.error("Quicklook", e);
            QuicklookPopupUI.showError("Failed to load.");
        } finally {
            PopupState.loadingUid = null;
        }
    },

    _scrollToQuicklookAnchor(hash, uid) {
        let targetId = hash.substring(1);
        if (targetId && !targetId.includes(':') && /^[\d\.]+$/.test(targetId)) {
            targetId = `${uid}:${targetId}`;
        }

        setTimeout(() => {
            const qBody = QuicklookPopupUI.elements.popupBody;
            const targetEl = qBody?.querySelector(`[id="${targetId}"]`);

            if (targetEl && qBody) {
                const containerRect = qBody.getBoundingClientRect();
                const elementRect = targetEl.getBoundingClientRect();
                const currentScroll = qBody.scrollTop;
                const targetPosition = currentScroll + (elementRect.top - containerRect.top) - QUICKLOOK_SCROLL_OFFSET;

                qBody.scrollTop = targetPosition;

                qBody.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                targetEl.classList.add('highlight');
            }
        }, 100);
    },

    _parseUrl(href) {
        try {
            const urlObj = new URL(href, window.location.origin);
            let uid = "";
            if (urlObj.searchParams.has("q")) {
                uid = urlObj.searchParams.get("q");
            } else {
                const parts = urlObj.pathname.split('/').filter(p => p);
                if (parts.length > 0) uid = parts[0];
            }
            if (!uid) return null;
            return { uid: uid, hash: urlObj.hash };
        } catch (e) { return null; }
    },

    _buildQuicklookTitle(meta, uid) {
        meta = meta || {};
        const acronym = meta.acronym || uid.toUpperCase();
        const title = meta.translated_title || meta.original_title || "";
        if (title) {
            return `<span class="ql-uid-badge">${acronym}</span><span class="ql-sutta-title">${title}</span>`;
        }
        return `<span class="ql-uid-badge">${acronym}</span>`;
    },

    _bindGlobalEvents() {
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                if (e.target.classList.contains("comment-marker")) {
                    e.stopPropagation();
                    this._openCommentByText(e.target.dataset.comment);
                } else {
                    if (QuicklookPopupUI.isVisible() && !QuicklookPopupUI.elements.popup.contains(e.target)) {
                        QuicklookPopupUI.hide();
                        // Nếu đóng Quicklook mà bên dưới có comment, ta nên active lại comment state?
                        // Logic hiện tại đơn giản hóa: Click ra ngoài Quicklook -> đóng QL.
                        // Click ra ngoài Comment -> đóng Comment.
                        // Nếu cần phục hồi comment state khi đóng QL, cần logic phức tạp hơn.
                        // Hiện tại tạm thời giữ logic cũ: Đóng là đóng.
                        // Update state:
                        // Nếu đóng QL, mà Comment vẫn hiện (do UI layer), thì state nên về comment?
                        // Để đơn giản, khi click outside Quicklook, ta coi như trạng thái là 'none' hoặc 'comment' tùy logic UI.
                        // Ở đây ta gọi closeAll cho chắc ăn.
                    } else if (CommentPopupUI.isVisible() && !CommentPopupUI.elements.popup.contains(e.target)) {
                        this.closeAll();
                    }
                }
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (QuicklookPopupUI.isVisible()) {
                    QuicklookPopupUI.hide();
                    // Nếu ẩn QL, state nên quay về comment nếu comment đang mở?
                    // Hiện tại set về none hoặc giữ nguyên comment cũ nếu không reset.
                    // Tạm thời Close All.
                    this.closeAll(); 
                }
                else if (CommentPopupUI.isVisible()) this.closeAll();
            }
            if (CommentPopupUI.isVisible() && !QuicklookPopupUI.isVisible()) {
                if (e.key === "ArrowLeft") this._navigateComment(-1);
                if (e.key === "ArrowRight") this._navigateComment(1);
            }
        });
    },

    _applyLayoutConfig() {
        const layout = AppConfig.POPUP_LAYOUT;
        if (layout) {
            const root = document.documentElement;
            root.style.setProperty('--popup-comment-height', `${layout.COMMENT_HEIGHT_VH}vh`);
            root.style.setProperty('--popup-quicklook-top', `${layout.QUICKLOOK_TOP_OFFSET_PX}px`);
        }
    }
};