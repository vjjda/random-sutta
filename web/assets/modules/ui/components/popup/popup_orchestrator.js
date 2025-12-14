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

        // 1. Init UI Modules
        CommentPopupUI.init({
            onClose: () => this.closeAll(),
            onNavigate: (dir) => this._navigateComment(dir),
            onLinkClick: (href) => this._handleLinkRequest(href)
        });

        QuicklookPopupUI.init({
            onClose: () => QuicklookPopupUI.hide(), // Chỉ đóng Quicklook, giữ Comment
            onDeepLink: (href) => this._navigateToMain(href),
            onOpenOriginal: (href) => this._handleFullPageNavigation(href)
        });

        // 2. Global Event Listeners
        this._bindGlobalEvents();
    },

    // --- STATE MANAGEMENT & RESTORATION (THE FIX) ---

    // Được gọi khi URL thay đổi hoặc App start
    restoreState() {
        const snapshot = PopupState.getSnapshot();
        if (!snapshot) return;

        logger.info("Restore", `Restoring State: CIdx=${snapshot.commentIndex}, QL=${snapshot.quicklookUrl}`);

        // 1. Restore Comment Popup
        if (snapshot.commentIndex !== undefined && snapshot.commentIndex !== -1) {
            // Đảm bảo dữ liệu comment đã được quét
            if (!PopupState.hasComments()) {
                const list = PopupScanner.scan("sutta-container");
                PopupState.setComments(list);
            }

            if (PopupState.hasComments()) {
                this._activateComment(snapshot.commentIndex);
                
                // Scroll main page instant
                const item = PopupState.comments[snapshot.commentIndex];
                if (item && item.id) Scroller.scrollToId(item.id, 'instant');
            }
        }

        // 2. Restore Quicklook Popup
        if (snapshot.quicklookUrl) {
            // [CRITICAL] Gọi với flag isRestoring = true
            this._handleLinkRequest(snapshot.quicklookUrl, true);
        }
    },

    // Được gọi khi chuyển trang hoàn toàn (nhấn nút Open Link)
    _handleFullPageNavigation(href) {
        // 1. Lưu trạng thái hiện tại vào History
        this._saveCurrentState();
        
        // 2. Chuyển hướng
        this._navigateToMain(href);
    },

    _saveCurrentState() {
        const isQLVisible = QuicklookPopupUI.isVisible();
        
        // Nếu QL đang mở, lấy URL từ nút External Link của nó
        // Nếu không, lấy null
        const qlUrl = isQLVisible ? QuicklookPopupUI.elements.externalLinkBtn.href : null;
        
        PopupState.saveSnapshot(isQLVisible, qlUrl);
    },

    // --- LOGIC METHODS ---

    scanComments() {
        const list = PopupScanner.scan("sutta-container");
        PopupState.setComments(list);
        PopupState.currentIndex = -1;
    },

    closeAll() {
        CommentPopupUI.hide();
        QuicklookPopupUI.hide();
        PopupState.loadingUid = null;
    },

    _openCommentByText(text) {
        // Quét lại nếu chưa có (phòng khi DOM thay đổi mà chưa scan)
        if (!PopupState.hasComments()) this.scanComments();

        const index = PopupState.comments.findIndex(c => c.text === text);
        if (index !== -1) {
            this._activateComment(index);
            QuicklookPopupUI.hide();
        }
    },

    _activateComment(index) {
        PopupState.currentIndex = index;
        const total = PopupState.comments.length;
        const item = PopupState.comments[index];
        const context = PopupScanner.getContextText(PopupState.comments, index);
        
        CommentPopupUI.render(item.text, index, total, context);
    },

    _navigateComment(dir) {
        const nextIdx = PopupState.currentIndex + dir;
        if (nextIdx >= 0 && nextIdx < PopupState.comments.length) {
            this._activateComment(nextIdx);
            
            // Scroll main view
            const item = PopupState.comments[nextIdx];
            if (item.id) Scroller.scrollToId(item.id, 'smooth');
            
            QuicklookPopupUI.hide();
        }
    },

    // Xử lý link từ Comment hoặc Quicklook (Đệ quy)
    async _handleLinkRequest(href, isRestoring = false) {
        const parsed = this._parseUrl(href);
        if (!parsed) return;
        const { uid, hash } = parsed;

        // Prevent double fetch
        if (PopupState.loadingUid === uid) return;
        PopupState.loadingUid = uid;

        // [CRITICAL FIX] Hiển thị UI ngay lập tức khi Restore
        // Để người dùng thấy popup đang mở (dù đang loading)
        QuicklookPopupUI.showLoading(uid.toUpperCase());

        try {
            const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
            
            if (data && data.content) {
                const renderRes = LeafRenderer.render(data);
                const displayTitle = this._buildQuicklookTitle(data.meta, uid);
                
                QuicklookPopupUI.render(renderRes.html, displayTitle, href);

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
        // Hash format: #17.4 -> targetId: mn127:17.4
        let targetId = hash.substring(1);
        if (targetId && !targetId.includes(':') && /^[\d\.]+$/.test(targetId)) {
            targetId = `${uid}:${targetId}`;
        }

        setTimeout(() => {
            const qBody = QuicklookPopupUI.elements.popupBody;
            const targetEl = qBody?.querySelector(`[id="${targetId}"]`);

            if (targetEl && qBody) {
                // Calculation logic (copied from previous fix)
                const containerRect = qBody.getBoundingClientRect();
                const elementRect = targetEl.getBoundingClientRect();
                const currentScroll = qBody.scrollTop;
                const targetPosition = currentScroll + (elementRect.top - containerRect.top) - QUICKLOOK_SCROLL_OFFSET;

                qBody.scrollTop = targetPosition;

                // Highlight
                qBody.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                targetEl.classList.add('highlight');
            }
        }, 100); // 100ms delay to ensure rendering
    },

    _navigateToMain(href) {
        this.closeAll();
        const parsed = this._parseUrl(href);
        if (parsed) {
            let loadId = parsed.uid;
            if (parsed.hash) loadId += parsed.hash;
            // Instant scroll for main view navigation
            window.loadSutta(loadId, true, 0, { transition: false });
        }
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
                    // Click Outside Logic
                    if (QuicklookPopupUI.isVisible() && !QuicklookPopupUI.elements.popup.contains(e.target)) {
                        QuicklookPopupUI.hide();
                    } else if (CommentPopupUI.isVisible() && !CommentPopupUI.elements.popup.contains(e.target)) {
                        this.closeAll();
                    }
                }
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (QuicklookPopupUI.isVisible()) QuicklookPopupUI.hide();
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