// Path: web/assets/modules/utils.js

window.getSuttaDisplayInfo = function (id) {
  let info = { title: id.toUpperCase(), subtitle: "" };
  if (window.SUTTA_DB && window.SUTTA_DB[id]) {
    const data = window.SUTTA_DB[id];
    if (data.acronym) info.title = data.acronym;
    if (data.translated_title) {
      info.subtitle = data.translated_title;
    } else if (data.original_title) {
      info.subtitle = data.original_title;
    }
  }
  return info;
};

// --- ĐÃ XÓA updateURL ---

window.initCommentPopup = function () {
    // ... (Giữ nguyên logic popup cũ) ...
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
};