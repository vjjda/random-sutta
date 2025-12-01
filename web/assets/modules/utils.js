// Path: web/assets/modules/utils.js

window.getSuttaDisplayInfo = function (id) {
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
};

// UPDATED: Thêm tham số enableRandomMode
window.updateURL = function (suttaId, bookParam, enableRandomMode = false) {
  try {
    const params = new URLSearchParams(window.location.search);

    // 1. Xử lý chế độ Random Loop (?r=1)
    if (enableRandomMode) {
      params.set("r", "1");
      params.delete("q"); // Xóa ID cụ thể để F5 sẽ ra bài mới
    }
    // 2. Xử lý Sutta ID cụ thể (Khi bấm nút Random hoặc Next/Prev)
    else if (suttaId) {
      params.set("q", suttaId);
      params.delete("r"); // Thoát chế độ Random Loop
    }

    // 3. Xử lý Books Param
    if (bookParam) {
      params.set("b", bookParam);
    } else {
      params.delete("b");
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Nếu đang ở Random Mode thì suttaId là null, ta không cần lưu state cụ thể
    const stateId = enableRandomMode ? null : suttaId || params.get("q");

    window.history.pushState({ suttaId: stateId }, "", newUrl);
  } catch (e) {
    console.warn("Could not update URL:", e);
  }
};

window.initCommentPopup = function () {
  // ... (Giữ nguyên code cũ) ...
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
