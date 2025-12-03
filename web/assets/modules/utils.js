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
            if (href && href.startsWith("index.html?q=")) {
                event.preventDefault();
                const urlParts = href.split("?");
                if (urlParts.length > 1) {
                    const params = new URLSearchParams(urlParts[1]);
                    const suttaId = params.get("q");
                    if (suttaId && window.loadSutta) {
                        hideComment();
                        const [cleanId, hash] = suttaId.split("#");
                        window.loadSutta(cleanId);
                        if (hash || href.includes("#")) {
                             const targetHash = hash || href.split("#")[1];
                             setTimeout(() => {
                                 const el = document.getElementById(targetHash);
                                 if(el) {
                                     el.scrollIntoView({behavior: "smooth", block: "center"});
                                     el.classList.add("highlight");
                                 }
                             }, 100);
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
}