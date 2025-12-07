// Path: web/assets/modules/ui/components/popup.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("PopupHandler");

export function initCommentPopup() {
    const popup = document.getElementById("comment-popup");
    const content = document.getElementById("comment-content");
    const closeBtn = document.getElementById("close-comment");
    const container = document.getElementById("sutta-container");

    if (!popup || !content || !closeBtn || !container) {
        logger.warn("initCommentPopup", "One or more required DOM elements for comment popup are missing.");
        return { hideComment: () => {} };
    }

    function showComment(text) {
        content.innerHTML = text;
        popup.classList.remove("hidden");
    }

    function hideComment() {
        popup.classList.add("hidden");
    }
    
    // Xử lý click vào marker chú giải trong nội dung bài kinh
    container.addEventListener("click", (event) => {
        if (event.target.classList.contains("comment-marker")) {
            const text = event.target.dataset.comment;
            if (text) {
                showComment(text);
                event.stopPropagation();
            }
        } else {
            // Click ra ngoài thì đóng popup
            if (!popup.classList.contains('hidden') && !popup.contains(event.target)) {
                 hideComment();
            }
        }
    });

    // Xử lý link bên trong nội dung popup (nếu có refer đến bài kinh khác)
    content.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (link && link.href) {
            try {
                const urlObj = new URL(link.href);
                // Nếu link trỏ về suttacentral hoặc internal nav
                if (urlObj.searchParams.has("q")) {
                    event.preventDefault();
                    let suttaId = urlObj.searchParams.get("q");
                    const urlHash = urlObj.hash; 
                    if (suttaId && urlHash) {
                        suttaId += urlHash; 
                    }
                    
                    if (suttaId && window.loadSutta) {
                        hideComment();
                        window.loadSutta(suttaId, true, 0);
                    }
                }
            } catch (e) {
                logger.warn('content.click', `Invalid link clicked in popup: ${link.href}`, e);
            }
        }
    });

    closeBtn.addEventListener("click", (e) => {
        hideComment();
        e.stopPropagation();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideComment();
    });

    return { hideComment };
}