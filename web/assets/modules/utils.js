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
            const href = link.getAttribute("href");
            
            // Chỉ xử lý link nội bộ
            if (href && href.startsWith("index.html?q=")) {
                event.preventDefault();
                
                // [FIX LOGIC LẤY ID] 
                // Tách phần Query và phần Hash riêng biệt để đảm bảo không bị mất Hash
                const [urlBase, urlHash] = href.split("#");
                const urlParts = urlBase.split("?");

                if (urlParts.length > 1) {
                    const params = new URLSearchParams(urlParts[1]);
                    let suttaId = params.get("q"); // Lấy ID cơ bản (vd: mn38)

                    // Nếu link gốc có hash (#35.1), nối nó vào suttaId (thành mn38#35.1)
                    if (suttaId && urlHash) {
                        suttaId += `#${urlHash}`;
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
                            // Gọi loadSutta với FULL ID (bao gồm hash)
                            // Truyền noScroll: true để chặn renderer tự cuộn (tránh giật)
                            window.loadSutta(suttaId, true, 0, { noScroll: true });

                            // Xử lý cuộn thủ công đến Hash
                            const targetHash = urlHash; // Dùng trực tiếp hash lấy từ href
                            
                            if (targetHash) {
                                const el = document.getElementById(targetHash);
                                if(el) {
                                    el.scrollIntoView({behavior: "auto", block: "center"});
                                    el.classList.add("highlight");
                                }
                            } else {
                                window.scrollTo(0, 0);
                            }

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