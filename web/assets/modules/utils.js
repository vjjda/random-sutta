// Path: web/assets/modules/utils.js

window.getSuttaDisplayInfo = function(id) {
    let info = { title: id.toUpperCase(), subtitle: "" };
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

// UPDATED: Nhận thêm bookParam
window.updateURL = function(suttaId, bookParam) {
    try {
        const params = new URLSearchParams(window.location.search);
        
        // 1. Set Sutta ID
        if (suttaId) {
            params.set("q", suttaId);
        }

        // 2. Set Books Param (nếu có thì set, không có thì xóa)
        if (bookParam) {
            params.set("b", bookParam);
        } else {
            params.delete("b");
        }

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ suttaId: suttaId }, "", newUrl);
    } catch (e) {
        console.warn("Could not update URL:", e);
    }
}

window.initCommentPopup = function() {
    // ... (Giữ nguyên phần logic popup cũ) ...
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

    return { hideComment };
}