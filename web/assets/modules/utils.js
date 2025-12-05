/* Path: web/assets/modules/utils.js */
import { Scroller } from './scroller.js';
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
            const urlObj = new URL(link.href);
            
            if (urlObj.searchParams.has("q")) {
                event.preventDefault();
                
                let suttaId = urlObj.searchParams.get("q");
                const urlHash = urlObj.hash; 

                if (suttaId && urlHash) {
                    suttaId += urlHash; 
                }
                
                if (suttaId && window.loadSutta) {
                    hideComment();
                    
                    // [UPDATED] Logic gọn gàng hơn nhiều
                    // Load nội dung mới (noScroll: true để Renderer không tự cuộn linh tinh)
                    window.loadSutta(suttaId, true, 0, { noScroll: true });

                    // Sau đó ủy quyền việc cuộn cho Scroller (nó sẽ tự làm hiệu ứng Fade)
                    if (urlHash) {
                        const targetId = urlHash.substring(1);
                        // Đợi 1 chút để render xong rồi mới scroll
                        setTimeout(() => Scroller.scrollToId(targetId), 50); 
                    } else {
                         window.scrollTo(0, 0);
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