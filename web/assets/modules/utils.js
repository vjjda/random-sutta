// Path: web/assets/modules/utils.js

window.getSuttaDisplayInfo = function (id) {
  let info = { title: id.toUpperCase(), subtitle: "" };
  
  // Sử dụng DB Manager để lấy meta thay vì truy cập trực tiếp
  const meta = window.DB.getMeta(id);
  
  if (meta) {
    if (meta.acronym) info.title = meta.acronym;
    if (meta.translated_title) {
      info.subtitle = meta.translated_title;
    } else if (meta.original_title) {
      info.subtitle = meta.original_title;
    }
  }
  return info;
};

window.initCommentPopup = function () {
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
    
    // Delegate event cho comment marker
    container.addEventListener("click", (event) => {
        if (event.target.classList.contains("comment-marker")) {
            const text = event.target.dataset.comment;
            if (text) {
                showComment(text);
                event.stopPropagation();
            }
        } else {
            // Click ra ngoài marker thì đóng
            // Lưu ý: Click vào popup chính nó không nên đóng (được xử lý bởi event propagation mặc định)
            // Nhưng ở đây ta bắt click trên container, popup nằm ngoài container hoặc absolute trên nó
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