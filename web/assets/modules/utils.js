// Path: web/assets/modules/utils.js

// --- HELPER: GET METADATA ---
export function getSuttaDisplayInfo(id) {
    let info = {
        title: id.toUpperCase(), 
        subtitle: ""
    };
    if (window.SUTTA_NAMES && window.SUTTA_NAMES[id]) {
        const meta = window.SUTTA_NAMES[id];
        if (meta.acronym) info.title = meta.acronym;
        
        if (meta.translated_title) {
            info.subtitle = meta.translated_title;
        } else if (meta.original_title) {
            info.subtitle = meta.original_title;
        }
    }
    return info;
}

// --- URL HELPER ---
export function updateURL(suttaId) {
    try {
        const currentUrl = new URL(window.location.search, window.location.origin + window.location.pathname);
        currentUrl.searchParams.set("q", suttaId);
        // Xóa hash để tránh scroll lung tung khi đổi bài
        window.history.pushState({ suttaId: suttaId }, "", currentUrl.toString());
    } catch (e) {
        console.warn("Could not update URL:", e);
    }
}

// --- COMMENT POPUP LOGIC ---
export function initCommentPopup() {
    const popup = document.getElementById("comment-popup");
    const content = document.getElementById("comment-content");
    const closeBtn = document.getElementById("close-comment");
    const container = document.getElementById("sutta-container");

    function showComment(text) {
        content.innerHTML = text;
        popup.classList.remove("hidden");
    }

    function hideComment() {
        popup.classList.add("hidden");
    }

    // Event Delegation cho container
    container.addEventListener("click", (event) => {
        if (event.target.classList.contains("comment-marker")) {
            const text = event.target.dataset.comment;
            if (text) {
                showComment(text);
                event.stopPropagation();
            }
        } else {
            hideComment();
        }
    });

    closeBtn.addEventListener("click", (e) => {
        hideComment();
        e.stopPropagation();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideComment();
    });

    return { hideComment }; // Export hàm hide để dùng khi chuyển trang
}