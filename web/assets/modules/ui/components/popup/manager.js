// Path: web/assets/modules/ui/components/popup/manager.js
import { CommentLayer } from './comment_layer.js';
import { QuicklookLayer } from './quicklook_layer.js';
import { Scroller } from 'ui/common/scroller.js';
import { getLogger } from 'utils/logger.js';
import { SuttaService } from 'services/sutta_service.js';
import { LeafRenderer } from 'ui/views/renderers/leaf_renderer.js';
import { AppConfig } from 'core/app_config.js';
import { getCleanTextContent } from 'ui/components/toh/text_utils.js';

const logger = getLogger("PopupManager");
const QUICKLOOK_SCROLL_OFFSET = 60; 

export const PopupManager = {
    state: {
        comments: [],
        currentIndex: -1,
        loadingUid: null 
    },

    init() {
        this._applyLayoutConfig();
        
        CommentLayer.init({
            onClose: () => this.hideAll(),
            onNavigate: (dir) => this._navigateComment(dir),
            onLinkClick: (href) => this._handleCommentLink(href)
        });
        
        QuicklookLayer.init({
            onDeepLink: (href) => this._navigateToMain(href),
            // [CRITICAL] Handler này chịu trách nhiệm lưu state trước khi đi
            onOpenOriginal: (href) => this._handleExternalLink(href)
        });

        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                if (e.target.classList.contains("comment-marker")) {
                    e.stopPropagation();
                    const text = e.target.dataset.comment;
                    this._openComment(text);
                } else {
                    // Click outside logic
                    if (QuicklookLayer.isVisible() && !document.getElementById("quicklook-popup").contains(e.target)) {
                        QuicklookLayer.hide();
                    } else if (CommentLayer.isVisible() && !document.getElementById("comment-popup").contains(e.target)) {
                        this.hideAll();
                    }
                }
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (QuicklookLayer.isVisible()) QuicklookLayer.hide();
                else if (CommentLayer.isVisible()) this.hideAll();
            }
            if (CommentLayer.isVisible() && !QuicklookLayer.isVisible()) {
                if (e.key === "ArrowLeft") this._navigateComment(-1);
                if (e.key === "ArrowRight") this._navigateComment(1);
            }
        });
    },

    saveState() {
        try {
            const currentState = window.history.state || {};
            
            // Logic xác định state: Nếu Quicklook mở, ta vẫn cần biết Comment nào đang active bên dưới
            // CommentLayer có thể bị che khuất nhưng logic vẫn active
            const isCommentActive = this.state.currentIndex !== -1;
            
            const popupState = {
                commentIndex: isCommentActive ? this.state.currentIndex : -1,
                // Chỉ lưu URL quicklook nếu nó đang thực sự mở
                quicklookUrl: QuicklookLayer.isVisible() ? QuicklookLayer.elements.externalLinkBtn.href : null
            };

            logger.info("StateSave", `Snapshot: CommentIdx=${popupState.commentIndex}, QL=${popupState.quicklookUrl ? 'Yes' : 'No'}`);
            
            // Ghi đè state hiện tại với thông tin popup
            window.history.replaceState(
                { ...currentState, popupState }, 
                document.title, 
                window.location.href
            );
        } catch (e) {
            logger.error("StateSave", e);
        }
    },

    async restoreState() {
        try {
            const state = window.history.state;
            if (!state || !state.popupState) {
                return;
            }

            const { commentIndex, quicklookUrl } = state.popupState;
            logger.info("StateRestore", `Restoring: CommentIdx=${commentIndex}, QL=${quicklookUrl}`);

            // 1. Khôi phục Comment Popup trước
            if (commentIndex !== undefined && commentIndex !== -1) {
                // Quét lại comment markers nếu cần (vì trang vừa load xong)
                if (this.state.comments.length === 0) {
                    this.scanComments();
                }

                if (this.state.comments.length > 0 && commentIndex < this.state.comments.length) {
                    this.state.currentIndex = commentIndex;
                    const item = this.state.comments[commentIndex];
                    // Hiển thị popup
                    CommentLayer.show(item.text, commentIndex, this.state.comments.length, this._getCurrentContextText());
                    // Scroll trang chính đến vị trí comment
                    if (item.id) Scroller.scrollToId(item.id, 'instant');
                }
            }

            // 2. Khôi phục Quicklook Popup (nếu có)
            if (quicklookUrl) {
                await this._handleCommentLink(quicklookUrl, true);
            }
        } catch (e) {
            logger.error("StateRestore", e);
        }
    },

    // [CRITICAL FIX] Hàm xử lý khi bấm nút "Open Link" (Mũi tên chéo)
    _handleExternalLink(href) {
        // 1. Lưu trạng thái hiện tại (Popup đang mở) vào History Entry HIỆN TẠI
        this.saveState();
        
        // 2. Chuyển hướng sang trang mới (Tạo History Entry MỚI)
        this._navigateToMain(href);
    },

    _applyLayoutConfig() {
        const layout = AppConfig.POPUP_LAYOUT;
        if (layout) {
            const root = document.documentElement;
            root.style.setProperty('--popup-comment-height', `${layout.COMMENT_HEIGHT_VH}vh`);
            root.style.setProperty('--popup-quicklook-top', `${layout.QUICKLOOK_TOP_OFFSET_PX}px`);
        }
    },

    scanComments() {
        const container = document.getElementById("sutta-container");
        if (!container) return;
        const markers = container.querySelectorAll(".comment-marker");
        this.state.comments = Array.from(markers).map(marker => ({
            id: marker.closest('.segment')?.id,
            text: marker.dataset.comment,
            element: marker.closest('.segment') 
        }));
        // Không reset currentIndex = -1 ở đây để tránh mất state khi restore gọi scan
    },

    _getCurrentContextText() {
        if (this.state.currentIndex !== -1 && this.state.comments[this.state.currentIndex]) {
            const currentSeg = this.state.comments[this.state.currentIndex].element;
            if (currentSeg) {
                return getCleanTextContent(currentSeg);
            }
        }
        return "";
    },

    _openComment(text) {
        // Quét lại để đảm bảo đồng bộ
        if (this.state.comments.length === 0) this.scanComments();
        
        this.state.currentIndex = this.state.comments.findIndex(c => c.text === text);
        if (this.state.currentIndex !== -1) {
            CommentLayer.show(text, this.state.currentIndex, this.state.comments.length, this._getCurrentContextText());
            QuicklookLayer.hide(); 
        }
    },

    _navigateComment(dir) {
        const nextIdx = this.state.currentIndex + dir;
        if (nextIdx < 0 || nextIdx >= this.state.comments.length) return;

        this.state.currentIndex = nextIdx;
        const item = this.state.comments[nextIdx];
        
        CommentLayer.show(item.text, nextIdx, this.state.comments.length, this._getCurrentContextText());
        if (item.id) Scroller.scrollToId(item.id);
        
        QuicklookLayer.hide();
    },

    async _handleCommentLink(href, isRestoring = false) {
        try {
            let uid = "";
            let hash = "";
            const urlObj = new URL(href, window.location.origin);
            if (urlObj.searchParams.has("q")) {
                uid = urlObj.searchParams.get("q");
            } else {
                const parts = urlObj.pathname.split('/').filter(p => p);
                if (parts.length > 0) uid = parts[0];
            }
            hash = urlObj.hash;
            if (!uid) return;

            if (this.state.loadingUid === uid) return;
            this.state.loadingUid = uid;
            
            if (!isRestoring) {
                QuicklookLayer.show(
                    '<div style="text-align:center; padding: 20px;">Loading...</div>', 
                    uid.toUpperCase()
                );
            }
            
            try {
                const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
                if (data && data.content) {
                    const renderRes = LeafRenderer.render(data);
                    const meta = data.meta || {};
                    const acronym = meta.acronym || uid.toUpperCase();
                    const titleText = meta.translated_title || meta.original_title || "";
                    const displayTitle = titleText 
                        ? `<span class="ql-uid-badge">${acronym}</span><span class="ql-sutta-title">${titleText}</span>` 
                        : `<span class="ql-uid-badge">${acronym}</span>`;
                    
                    // Show popup với nội dung đã load
                    QuicklookLayer.show(renderRes.html, displayTitle, href);
                    
                    // Xử lý scroll đến anchor (hash)
                    if (hash) {
                        let targetId = hash.substring(1);
                        if (targetId && !targetId.includes(':')) {
                            const isSegmentNumber = /^[\d\.]+$/.test(targetId);
                            if (isSegmentNumber) targetId = `${uid}:${targetId}`;
                        }

                        // Instant Jump Logic
                        setTimeout(() => {
                            const qBody = document.querySelector("#quicklook-popup .popup-body");
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
                    }
                } else {
                    QuicklookLayer.show('<p class="error-message">Content not available.</p>', "Error");
                }
            } finally {
                this.state.loadingUid = null;
            }

        } catch (e) {
            this.state.loadingUid = null;
            logger.error("Quicklook", e);
            QuicklookLayer.show('<p class="error-message">Failed to load preview.</p>', "Error");
        }
    },

    _navigateToMain(href) {
        // Ẩn Popup ngay lập tức để chuyển trang mượt mà
        QuicklookLayer.hide();
        CommentLayer.hide();
        
        try {
            const urlObj = new URL(href, window.location.origin);
            let uid = "";
            if (urlObj.searchParams.has("q")) {
                uid = urlObj.searchParams.get("q");
            } else {
                const parts = urlObj.pathname.split('/').filter(p => p);
                if (parts.length > 0) uid = parts[0];
            }
            if (uid) {
                if (urlObj.hash) uid += urlObj.hash;
                // Transition false -> Instant Scroll
                window.loadSutta(uid, true, 0, { transition: false });
            }
        } catch(e) {}
    },
    
    hideAll() {
        CommentLayer.hide();
        QuicklookLayer.hide();
        this.state.loadingUid = null;
    }
};