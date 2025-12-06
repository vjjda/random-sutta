// Path: web/assets/modules/ui/popup_handler.js
import { getLogger } from '../shared/logger.js';

const logger = getLogger("PopupHandler");

/**
 * Khởi tạo logic cho Popup chú giải (Comment).
 */
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
    
    container.addEventListener("click", (event) => {
        if (event.target.classList.contains("comment-marker")) {
            const text = event.target.dataset.comment;
            if (text) {
                showComment(text);
                event.stopPropagation();
            }
        } else {
            if (!popup.classList.contains('hidden') && !popup.contains(event.target)) {
                 hideComment();
            }
        }
    });

    content.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (link && link.href) {
            try {
                const urlObj = new URL(link.href);
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
