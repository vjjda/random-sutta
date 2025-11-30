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

// UPDATED: suttaId là optional. Nếu null, giữ nguyên ID hiện tại.
window.updateURL = function(suttaId, bookParam) {
    try {
        const params = new URLSearchParams(window.location.search);
        
        // 1. Xử lý Sutta ID
        if (suttaId) {
            params.set("q", suttaId);
        } 
        // Nếu suttaId là null/undefined, ta KHÔNG làm gì cả -> Giữ nguyên ?q= cũ

        // 2. Xử lý Books Param
        if (bookParam) {
            params.set("b", bookParam);
        } else {
            params.delete("b");
        }

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        
        // Lấy suttaId hiện tại để lưu vào history state nếu không có suttaId mới
        const currentSuttaId = suttaId || params.get("q");
        
        // Dùng replaceState thay vì pushState nếu chỉ đổi filter để tránh làm rác lịch sử Back button
        // Nhưng nếu muốn Back quay lại trạng thái filter cũ thì dùng pushState. 
        // Ở đây dùng pushState cho nhất quán.
        window.history.pushState({ suttaId: currentSuttaId }, "", newUrl);
    } catch (e) {
        console.warn("Could not update URL:", e);
    }
}

window.initCommentPopup = function() {
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