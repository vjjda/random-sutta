// Path: web/assets/modules/utils.js
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
    
    // Delegate event cho comment marker
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

    // Delegate event cho link trong popup (SPA Navigation)
    content.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (link) {
            const href = link.getAttribute("href");
            // Chỉ xử lý link nội bộ (SPA)
            if (href && href.startsWith("index.html?q=")) {
                event.preventDefault();
                
                const urlParts = href.split("?");
                if (urlParts.length > 1) {
                    const params = new URLSearchParams(urlParts[1]);
                    const suttaId = params.get("q");
                    
                    if (suttaId && window.loadSutta) {
                        hideComment();
                        
                        // --- START: STATIC FADE NAVIGATION ---
                        const container = document.getElementById("sutta-container");
                        
                        // 1. Thêm class transition (để đảm bảo mượt)
                        container.classList.add("static-fade-transition");
                        
                        // 2. Trigger Fade Out
                        requestAnimationFrame(() => {
                            container.classList.add("static-fade-out");
                        });

                        // 3. Đợi Fade Out xong (150ms) thì mới load nội dung mới
                        setTimeout(() => {
                            const [cleanId, hash] = suttaId.split("#");
                            
                            // Load dữ liệu mới (Render lại DOM)
                            window.loadSutta(cleanId);

                            // Xử lý Hash Scroll (nếu link có #)
                            // Logic: Load xong -> Scroll đến vị trí -> Mới hiện lại (Fade In)
                            const targetHash = hash || (href.includes("#") ? href.split("#")[1] : null);
                            
                            if (targetHash) {
                                const el = document.getElementById(targetHash);
                                if(el) {
                                    // Scroll ngay lập tức (behavior: auto) khi đang ẩn để người dùng không thấy cảnh trượt
                                    el.scrollIntoView({behavior: "auto", block: "center"});
                                    el.classList.add("highlight");
                                }
                            } else {
                                // Nếu không có hash, lên đầu trang
                                window.scrollTo(0, 0);
                            }

                            // 4. Trigger Fade In
                            requestAnimationFrame(() => {
                                container.classList.remove("static-fade-out");
                                
                                // Dọn dẹp class transition sau khi xong để không ảnh hưởng tương lai
                                setTimeout(() => {
                                    container.classList.remove("static-fade-transition");
                                }, 150);
                            });

                        }, 150); // Thời gian khớp với CSS
                        // --- END: STATIC FADE NAVIGATION ---
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
}