// Path: web/assets/modules/utils.js

window.getSuttaDisplayInfo = function (id) {
  let info = { title: id.toUpperCase(), subtitle: "" };
  
  // NEW LOGIC: Look inside SUTTA_DB directly
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

// ... (Giữ nguyên phần updateURL và initCommentPopup) ...
// Các hàm phía dưới không thay đổi
window.updateURL = function (suttaId, bookParam, enableRandomMode = false) {
    // ... code cũ giữ nguyên
    try {
        const params = new URLSearchParams(window.location.search);
        if (enableRandomMode) {
            params.set("r", "1");
            params.delete("q");
        } else if (suttaId) {
            params.set("q", suttaId);
            params.delete("r");
        }
        if (bookParam) {
            params.set("b", bookParam);
        } else {
            params.delete("b");
        }
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        const stateId = enableRandomMode ? null : suttaId || params.get("q");
        window.history.pushState({ suttaId: stateId }, "", newUrl);
    } catch (e) {
        console.warn("Could not update URL:", e);
    }
};

window.initCommentPopup = function () {
    // ... code cũ giữ nguyên
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