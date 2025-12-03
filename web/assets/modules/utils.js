// Path: web/assets/modules/utils.js

window.getSuttaDisplayInfo = function (id) {
  let info = { title: id.toUpperCase(), subtitle: "" };
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
    
    // Delegate event cho comment marker (Mở popup)
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

    // [NEW] Delegate event cho các link BÊN TRONG popup content
    // Để chặn việc reload trang khi click link tham chiếu
    content.addEventListener("click", (event) => {
        // Tìm thẻ <a> gần nhất (đề phòng click vào thẻ con như <i>, <b> bên trong <a>)
        const link = event.target.closest("a");
        
        if (link) {
            const href = link.getAttribute("href");
            
            // Chỉ xử lý các link nội bộ (do Python build ra)
            if (href && href.startsWith("index.html?q=")) {
                event.preventDefault(); // <--- CHẶN RELOAD TRANG
                
                // Trích xuất suttaId từ href
                // href ví dụ: index.html?q=dn3#1.2.1
                const urlParts = href.split("?");
                if (urlParts.length > 1) {
                    const params = new URLSearchParams(urlParts[1]);
                    const suttaId = params.get("q");
                    
                    if (suttaId && window.loadSutta) {
                        hideComment(); // Đóng popup
                        
                        // Chuyển hướng bằng SPA Router
                        // Lưu ý: loadSutta sẽ tự xử lý cả hash (#1.2.1) nếu có trong URL (cần update router một chút nếu chưa support hash, nhưng loadSutta hiện tại gọi renderSutta có checkHash)
                        
                        // Tuy nhiên loadSutta nhận ID, hash nằm ở window.location hoặc phải truyền riêng.
                        // Cách đơn giản nhất: Push state trước rồi load.
                        
                        // Tách hash nếu có
                        const [cleanId, hash] = suttaId.split("#");
                        
                        window.loadSutta(cleanId);
                        
                        // Nếu có hash, scroll tới đó sau khi render
                        if (hash || href.includes("#")) {
                             const targetHash = hash || href.split("#")[1];
                             setTimeout(() => {
                                 const el = document.getElementById(targetHash);
                                 if(el) {
                                     el.scrollIntoView({behavior: "smooth", block: "center"});
                                     el.classList.add("highlight");
                                 }
                             }, 100); // Đợi render xong
                        }
                    }
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
};