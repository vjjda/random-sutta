// Path: web/assets/modules/ui/components/popup/manager.js
import { CommentLayer } from './comment_layer.js';
import { QuicklookLayer } from './quicklook_layer.js';
import { Scroller } from '../../common/scroller.js';
import { getLogger } from '../../../utils/logger.js';
import { SuttaService } from '../../../services/sutta_service.js';
import { LeafRenderer } from '../../views/renderers/leaf_renderer.js';
import { AppConfig } from '../../../core/app_config.js';

const logger = getLogger("PopupManager");

export const PopupManager = {
    state: {
        comments: [],
        currentIndex: -1
    },

    init() {
        this._applyLayoutConfig();

        // Init Layer 1: Comments
        CommentLayer.init({
            // [UPDATED] Khi đóng Comment, đóng luôn cả Quicklook (Reset toàn bộ)
            onClose: () => this.hideAll(),
            onNavigate: (dir) => this._navigateComment(dir),
            onLinkClick: (href) => this._handleCommentLink(href)
        });

        // Init Layer 2: Quicklook
        QuicklookLayer.init({
            onDeepLink: (href) => this._navigateToMain(href)
        });

        // Global Event for Markers
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                if (e.target.classList.contains("comment-marker")) {
                    e.stopPropagation();
                    const text = e.target.dataset.comment;
                    this._openComment(text);
                } else {
                    // Click outside -> Close logic
                    // Priority 1: Nếu Quicklook đang mở và click ra ngoài nó -> Chỉ đóng Quicklook
                    if (QuicklookLayer.isVisible() && !document.getElementById("quicklook-popup").contains(e.target)) {
                        QuicklookLayer.hide();
                    } 
                    // Priority 2: Nếu Comment đang mở và click ra ngoài nó -> Đóng tất cả (vì Quicklook neo theo Comment)
                    else if (CommentLayer.isVisible() && !document.getElementById("comment-popup").contains(e.target)) {
                        this.hideAll();
                    }
                }
            });
        }

        // [RESTORED] Keyboard Support (ESC & Arrows)
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                // Ưu tiên đóng Quicklook trước nếu đang mở
                if (QuicklookLayer.isVisible()) {
                    QuicklookLayer.hide();
                } 
                // Nếu chỉ có Comment mở thì đóng Comment
                else if (CommentLayer.isVisible()) {
                    this.hideAll();
                }
            }
            
            // Chỉ điều hướng bằng mũi tên khi Comment mở VÀ Quicklook đang đóng
            // (Để tránh xung đột nếu sau này Quicklook cũng cần scroll ngang)
            if (CommentLayer.isVisible() && !QuicklookLayer.isVisible()) {
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
    },

    // --- LOGIC: COMMENT NAVIGATOR ---
    scanComments() {
        const container = document.getElementById("sutta-container");
        if (!container) return;
        const markers = container.querySelectorAll(".comment-marker");
        this.state.comments = Array.from(markers).map(marker => ({
            id: marker.closest('.segment')?.id,
            text: marker.dataset.comment
        }));
        this.state.currentIndex = -1;
    },

    _openComment(text) {
        this.state.currentIndex = this.state.comments.findIndex(c => c.text === text);
        CommentLayer.show(text, this.state.currentIndex, this.state.comments.length);
        QuicklookLayer.hide(); 
    },

    _navigateComment(dir) {
        const nextIdx = this.state.currentIndex + dir;
        if (nextIdx < 0 || nextIdx >= this.state.comments.length) return;

        this.state.currentIndex = nextIdx;
        const item = this.state.comments[nextIdx];
        
        CommentLayer.show(item.text, nextIdx, this.state.comments.length);
        if (item.id) Scroller.scrollToId(item.id);
        
        QuicklookLayer.hide();
    },

    // --- LOGIC: QUICKLOOK ---
    async _handleCommentLink(href) {
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

            QuicklookLayer.show('<div style="text-align:center; padding: 20px;">Loading...</div>', uid.toUpperCase());

            const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
            
            if (data && data.content) {
                const renderRes = LeafRenderer.render(data);
                QuicklookLayer.show(renderRes.html, data.book_title || uid.toUpperCase());
                
                if (hash) {
                    let targetId = hash.substring(1); 
                    if (targetId && !targetId.includes(':')) {
                        const isSegmentNumber = /^[\d\.]+$/.test(targetId);
                        if (isSegmentNumber) {
                            targetId = `${uid}:${targetId}`;
                        }
                    }

                    setTimeout(() => {
                        const qBody = document.querySelector("#quicklook-popup .popup-body");
                        const targetEl = qBody?.querySelector(`[id="${targetId}"]`);
                        
                        if (targetEl && qBody) {
                            const offsetTop = targetEl.offsetTop;
                            qBody.scrollTop = offsetTop - 60;

                            qBody.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                            targetEl.classList.add('highlight');
                        }
                    }, 100);
                }
            } else {
                QuicklookLayer.show('<p class="error-message">Content not available.</p>', "Error");
            }

        } catch (e) {
            logger.error("Quicklook", e);
            QuicklookLayer.show('<p class="error-message">Failed to load preview.</p>', "Error");
        }
    },

    _navigateToMain(href) {
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
                window.loadSutta(uid, true, 0);
            }
        } catch(e){}
    },
    
    hideAll() {
        CommentLayer.hide();
        QuicklookLayer.hide();
    }
};