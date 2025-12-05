// Path: web/assets/modules/utils.js
import { DB } from './db_manager.js';

export function getSuttaDisplayInfo(id) {
  // ... (Giữ nguyên)
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
            // [FIX] Sử dụng API URL chuẩn thay vì parse chuỗi thủ công
            // link.href luôn trả về đường dẫn tuyệt đối (http://localhost...) dễ parse hơn
            const urlObj = new URL(link.href);
            
            // Chỉ xử lý nếu có param ?q=
            if (urlObj.searchParams.has("q")) {
                event.preventDefault();
                
                let suttaId = urlObj.searchParams.get("q"); // Lấy ID (vd: mn38)
                const urlHash = urlObj.hash; // Lấy hash (vd: #35.1) - Đã bao gồm dấu #

                // Nếu có hash, nối vào ID để controller biết đường update URL
                if (suttaId && urlHash) {
                    suttaId += urlHash; // mn38 + #35.1 -> mn38#35.1
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
                        // 1. Load Sutta (Controller update URL browser tại đây)
                        // Truyền noScroll: true để Renderer đứng yên
                        window.loadSutta(suttaId, true, 0, { noScroll: true });

                        // 2. Scroll thủ công (Ẩn sau màn Fade)
                        if (urlHash) {
                            // urlHash có dạng "#35.1", cần bỏ dấu # để tìm ID
                            const targetId = urlHash.substring(1); 
                            const el = document.getElementById(targetId);
                            if(el) {
                                // Scroll tức thì (không animation)
                                el.scrollIntoView({behavior: "auto", block: "center"});
                                el.classList.add("highlight");
                            }
                        } else {
                            // Nếu không có hash, về đầu trang
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