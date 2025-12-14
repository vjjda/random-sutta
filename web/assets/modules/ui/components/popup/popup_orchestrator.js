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

        // 1. Init UI
        CommentPopupUI.init({
            onClose: () => this.closeAll(),
            onNavigate: (dir) => this._navigateComment(dir),
            onLinkClick: (href) => this._handleLinkRequest(href)
        });

        QuicklookPopupUI.init({
            onClose: () => {
                // Đóng Quicklook, nếu có comment nền thì hiển thị lại comment (UX)
                // Hoặc đơn giản là đóng tất cả cho gọn.
                // Logic cũ là: Ẩn Quicklook, không làm gì Comment (nếu Comment đang mở nó sẽ lộ ra)
                QuicklookPopupUI.hide();
                // Update State: Quay về Comment nếu có
                if (PopupState.activeIndex !== -1) {
                    PopupState.activeType = 'comment';
                    PopupState.activeUrl = null;
                } else {
                    PopupState.clearActive();
                }
            },
            onDeepLink: (href) => this._navigateToMain(href),
            onOpenOriginal: (href) => this._handleFullPageNavigation(href)
        });

        // 2. Global Events
        this._bindGlobalEvents();
    },

    // --- RESTORATION LOGIC (FIXED) ---

    restoreState() {
        const snapshot = PopupState.getSnapshot();
        if (!snapshot || snapshot.type === 'none') return;

        logger.info("Restore", `Type: ${snapshot.type}`, snapshot);

        // 1. Restore Comment (Nền tảng)
        // Dù type là quicklook, nếu có commentIndex thì cũng nên restore comment ở dưới
        if (snapshot.commentIndex !== undefined && snapshot.commentIndex !== -1) {
            // Đảm bảo dữ liệu đã có
            this.scanComments(); 
            const comments = PopupState.getComments();
            
            if (comments.length > 0 && snapshot.commentIndex < comments.length) {
                // Render nhưng chưa chắc đã set là activeType cuối cùng (nếu quicklook đè lên)
                this._activateCommentUI(snapshot.commentIndex);
                
                // Scroll main page instant
                const item = comments[snapshot.commentIndex];
                if (item && item.id) Scroller.scrollToId(item.id, 'instant');
            }
        }

        // 2. Restore Quicklook (Lớp phủ)
        if (snapshot.type === 'quicklook' && snapshot.quicklookUrl) {
            // [CRITICAL] Gọi với flag isRestoring = true
            this._handleLinkRequest(snapshot.quicklookUrl, true);
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

    scanComments() {
        const list = PopupScanner.scan("sutta-container");
        PopupState.setComments(list);
    },

    closeAll() {
        CommentPopupUI.hide();
        QuicklookPopupUI.hide();
        PopupState.loadingUid = null;
        PopupState.clearActive();
    },

    // 1. Comment Actions
    _openCommentByText(text) {
        const comments = PopupState.getComments();
        if (comments.length === 0) this.scanComments();
        
        const index = PopupState.getComments().findIndex(c => c.text === text);
        if (index !== -1) {
            this._activateCommentUI(index);
            QuicklookPopupUI.hide();
        }
    },

    _activateCommentUI(index) {
        PopupState.setCommentActive(index); // Update State
        
        const comments = PopupState.getComments();
        const total = comments.length;
        const item = comments[index];
        const context = PopupScanner.getContextText(comments, index);
        
        CommentPopupUI.render(item.text, index, total, context);
    },

    _navigateComment(dir) {
        // Lấy index từ state
        let currentIdx = PopupState.activeIndex;
        const comments = PopupState.getComments();
        
        const nextIdx = currentIdx + dir;
        if (nextIdx >= 0 && nextIdx < comments.length) {
            this._activateCommentUI(nextIdx);
            
            const item = comments[nextIdx];
            if (item.id) Scroller.scrollToId(item.id, 'smooth');
            
            QuicklookPopupUI.hide();
        }
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
                
                // Update State thành Quicklook
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
                // Calculation logic (Instant Jump)
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

    // --- UTILS ---
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
                        // Update state: Nếu đóng QL, revert về comment nếu có
                        if (PopupState.activeIndex !== -1) {
                            PopupState.activeType = 'comment';
                            PopupState.activeUrl = null;
                        } else {
                            PopupState.clearActive();
                        }
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
                    // Revert state logic tương tự click outside
                    if (PopupState.activeIndex !== -1) {
                        PopupState.activeType = 'comment';
                        PopupState.activeUrl = null;
                    } else {
                        PopupState.clearActive();
                    }
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