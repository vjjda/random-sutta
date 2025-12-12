// Path: web/assets/modules/ui/components/popup/manager.js
import { CommentLayer } from './comment_layer.js';
import { QuicklookLayer } from './quicklook_layer.js';
import { Scroller } from '../../common/scroller.js';
import { getLogger } from '../../../../utils/logger.js';
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

        // Global Event for Markers
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                if (e.target.classList.contains("comment-marker")) {
                    e.stopPropagation();
                    const text = e.target.dataset.comment;
                    this._openComment(text);
                } else {
                    // Click outside -> Close all layers logic
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
        QuicklookLayer.hide(); // Đóng Quicklook nếu đang mở cái cũ
    },

    _navigateComment(dir) {
        const nextIdx = this.state.currentIndex + dir;
        if (nextIdx < 0 || nextIdx >= this.state.comments.length) return;

        this.state.currentIndex = nextIdx;
        const item = this.state.comments[nextIdx];
        
        CommentLayer.show(item.text, nextIdx, this.state.comments.length);
        if (item.id) Scroller.scrollToId(item.id);
        
        QuicklookLayer.hide(); // Đóng Quicklook khi chuyển comment
    },

    // --- LOGIC: QUICKLOOK ---
    async _handleCommentLink(href) {
        try {
            // Parse UID from href (vd: /mn1/en/sujato#1.1)
            // Logic đơn giản hóa: Lấy param q hoặc trích từ path
            let uid = "";
            let hash = "";
            
            // 1. URL Object parsing
            const urlObj = new URL(href, window.location.origin);
            
            if (urlObj.searchParams.has("q")) {
                uid = urlObj.searchParams.get("q");
            } else {
                // Fallback: Parse path segments
                // ex: /mn1/en/sujato
                const parts = urlObj.pathname.split('/').filter(p => p);
                // Giả định part đầu tiên là UID nếu không phải các path hệ thống
                if (parts.length > 0) uid = parts[0];
            }
            hash = urlObj.hash; // e.g. #mn1:2.3

            if (!uid) return;

            QuicklookLayer.show("Loading...", uid.toUpperCase());

            // 2. Fetch Data (Lightweight)
            // Ta dùng loadSutta nhưng không render ra main view
            const data = await SuttaService.loadSutta(uid, { prefetchNav: false });
            
            if (data && data.content) {
                // 3. Render HTML (Chỉ lấy phần content, không lấy footer/header)
                const renderRes = LeafRenderer.render(data);
                
                // 4. Inject & Scroll
                QuicklookLayer.show(renderRes.html, data.book_title || uid.toUpperCase());
                
                if (hash) {
                    // Scroll bên trong Quicklook body
                    const targetId = hash.substring(1);
                    const qBody = document.querySelector("#quicklook-popup .popup-body");
                    setTimeout(() => {
                        const el = qBody.querySelector(`[id="${targetId}"]`);
                        if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
                    }, 100);
                }
            } else {
                QuicklookLayer.show("Content not found.", "Error");
            }

        } catch (e) {
            logger.error("Quicklook", e);
            QuicklookLayer.show("Failed to load preview.", "Error");
        }
    },

    _navigateToMain(href) {
        // Chuyển từ Quicklook sang Main View
        QuicklookLayer.hide();
        CommentLayer.hide();
        
        // Giả lập click link (hoặc gọi loadSutta)
        // Vì href có thể phức tạp, ta dùng window.loadSutta nếu parse được
        // Ở đây để đơn giản ta parse lại
        try {
            const urlObj = new URL(href, window.location.origin);
            if (urlObj.searchParams.has("q")) {
                let uid = urlObj.searchParams.get("q");
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