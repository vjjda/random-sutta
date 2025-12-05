// Path: web/assets/modules/utils.js
// ...
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

    // Delegate event cho link trong popup
    content.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (link) {
            const urlObj = new URL(link.href);
            if (urlObj.searchParams.has("q")) {
                event.preventDefault();
                let suttaId = urlObj.searchParams.get("q");
                const urlHash = urlObj.hash;
                if (suttaId && urlHash) suttaId += urlHash;

                if (suttaId && window.loadSutta) {
                    hideComment();
                    // [UPDATED] Gọi loadSutta với cờ transition: true
                    // Controller sẽ tự lo liệu việc Fade Out -> Render -> Fade In -> Scroll
                    window.loadSutta(suttaId, true, 0, { transition: true });
                }
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