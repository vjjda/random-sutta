// Path: web/assets/modules/ui/components/popup/manager.js
import { CommentLayer } from './comment_layer.js';
import { QuicklookLayer } from './quicklook_layer.js';
import { Scroller } from '../../common/scroller.js';
import { getLogger } from '../../../utils/logger.js';
import { SuttaService } from '../../../services/sutta_service.js';
import { LeafRenderer } from '../../views/renderers/leaf_renderer.js';

const logger = getLogger("PopupManager");

export const PopupManager = {
    state: {
        comments: [],
        currentIndex: -1
    },

    init() {
        // Init Layer 1: Comments
        CommentLayer.init({
            onClose: () => CommentLayer.hide(),
            onNavigate: (dir) => this._navigateComment(dir),
            onLinkClick: (href) => this._handleCommentLink(href)
        });

        // Init Layer 2: Quicklook
        QuicklookLayer.init({
            onDeepLink: (href) => this._navigateToMain(href)
        });

        // Global Event for Markers (Main View)
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                if (e.target.classList.contains("comment-marker")) {
                    e.stopPropagation();
                    const text = e.target.dataset.comment;
                    this._openComment(text);
                } else {
                    // Click outside -> Close logic
                    // Priority: Close Quicklook first if open, else close Comment
                    if (QuicklookLayer.isVisible() && !document.getElementById("quicklook-popup").contains(e.target)) {
                        QuicklookLayer.hide();
                    } else if (CommentLayer.isVisible() && !document.getElementById("comment-popup").contains(e.target)) {
                        CommentLayer.hide();
                    }
                }
            });
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
                
                // Inject Content
                QuicklookLayer.show(renderRes.html, data.book_title || uid.toUpperCase());
                
                // [UPDATED] Instant Scroll & Highlight Logic
                if (hash) {
                    const targetId = hash.substring(1);
                    // Dùng setTimeout 0 để chờ DOM render xong
                    setTimeout(() => {
                        const qBody = document.querySelector("#quicklook-popup .popup-body");
                        const targetEl = qBody?.querySelector(`[id="${targetId}"]`);
                        
                        if (targetEl && qBody) {
                            // 1. Instant Jump: Tính toán offset và gán thẳng scrollTop
                            // Trừ đi một khoảng padding (ví dụ 60px) để không bị sát mép trên
                            const offsetTop = targetEl.offsetTop;
                            qBody.scrollTop = offsetTop - 60;

                            // 2. Apply Highlight
                            // Xóa highlight cũ trong popup này (nếu có)
                            qBody.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
                            
                            // Thêm class highlight (sử dụng CSS có sẵn)
                            targetEl.classList.add('highlight');
                        }
                    }, 0);
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