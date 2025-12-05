/* Path: web/assets/modules/utils.js */
import { DB } from './db_manager.js';

export function getSuttaDisplayInfo(id) {
  let info = { title: id.toUpperCase(), subtitle: "" };
  const meta = DB.getMeta(id);
  if (meta) {
    if (meta.acronym) info.title = meta.acronym;
    if (meta.translated_title) {
      info.subtitle = meta.translated_title;
    } else if (meta.original_title) {
      info.subtitle = meta.original_title;
    }
  }
  return info;
}

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
            // [FIX] Dùng new URL() để parse chính xác mọi thành phần
            // link.href luôn trả về absolute path (http://...) nên rất an toàn
            const urlObj = new URL(link.href);
            
            // Kiểm tra xem có param ?q= không
            if (urlObj.searchParams.has("q")) {
                event.preventDefault();
                
                let suttaId = urlObj.searchParams.get("q"); // Lấy ID sạch (vd: dn1)
                const urlHash = urlObj.hash; // Lấy hash (vd: #2.38.18) - bao gồm cả dấu #

                // Nối lại thành chuỗi ID đầy đủ để gửi cho Controller
                // Controller sẽ dùng phần này để update URL browser
                if (suttaId && urlHash) {
                    suttaId += urlHash; 
                }
                
                if (suttaId && window.loadSutta) {
                    hideComment();
                    
                    // --- START: STATIC FADE NAVIGATION ---
                    const container = document.getElementById("sutta-container");
                    container.classList.add("static-fade-transition");
                    
                    requestAnimationFrame(() => {
                        container.classList.add("static-fade-out");
                    });

                    setTimeout(() => {
                        // 1. Load Sutta 
                        // Truyền noScroll: true để Renderer chỉ render HTML, không cuộn lung tung
                        window.loadSutta(suttaId, true, 0, { noScroll: true });

                        // 2. Xử lý Scroll thủ công (Ẩn sau màn Fade)
                        if (urlHash) {
                            // Bỏ dấu # để lấy ID phần tử (vd: 2.38.18)
                            const targetId = urlHash.substring(1); 
                            
                            // Tìm và cuộn
                            const el = document.getElementById(targetId);
                            if(el) {
                                // behavior: "auto" để cuộn tức thì (người dùng không thấy chạy chạy)
                                el.scrollIntoView({behavior: "auto", block: "center"});
                                el.classList.add("highlight");
                            }
                        } else {
                            // Không có hash thì về đầu trang
                            window.scrollTo(0, 0);
                        }

                        // 3. Fade In trở lại
                        requestAnimationFrame(() => {
                            container.classList.remove("static-fade-out");
                            
                            setTimeout(() => {
                                container.classList.remove("static-fade-transition");
                            }, 150);
                        });

                    }, 150); 
                    // --- END: STATIC FADE NAVIGATION ---
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