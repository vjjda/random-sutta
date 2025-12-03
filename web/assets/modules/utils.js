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

export function initTableOfContents() {
    const wrapper = document.getElementById("toc-wrapper");
    const fab = document.getElementById("toc-fab");
    const menu = document.getElementById("toc-menu");
    const list = document.getElementById("toc-list");
    const container = document.getElementById("sutta-container");

    if (!wrapper || !fab || !menu || !list) return { generateToC: () => {} };

    // Toggle menu
    fab.onclick = (e) => {
        menu.classList.toggle("hidden");
        fab.classList.toggle("active");
        e.stopPropagation();
    };

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!menu.classList.contains("hidden") && !wrapper.contains(e.target)) {
            menu.classList.add("hidden");
            fab.classList.remove("active");
        }
    });

    function generateToC() {
        // Reset state
        list.innerHTML = "";
        menu.classList.add("hidden");
        fab.classList.remove("active");
        
        // 1. Find Headings (h2, h3, h4) inside the article
        // Note: h1 is usually the title, we skip it.
        const headings = container.querySelectorAll("h2, h3, h4");

        // Nếu có ít hơn 2 heading thì không cần hiện ToC
        if (headings.length < 2) {
            wrapper.classList.add("hidden");
            return;
        }

        wrapper.classList.remove("hidden");

        // 2. Build List
        headings.forEach((heading, index) => {
            // Ensure heading has an ID
            if (!heading.id) {
                heading.id = `toc-heading-${index}`;
            }

            const li = document.createElement("li");
            li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
            
            const a = document.createElement("span"); // Dùng span để handle click tay cho mượt
            a.className = "toc-link";
            a.textContent = heading.textContent;
            
            a.onclick = () => {
                // Smooth scroll
                heading.scrollIntoView({ behavior: "smooth", block: "center" });
                // Highlight effect
                heading.classList.add("highlight");
                setTimeout(() => heading.classList.remove("highlight"), 2000);
                
                // Close menu (mobile friendly)
                if (window.innerWidth < 768) {
                    menu.classList.add("hidden");
                    fab.classList.remove("active");
                }
            };

            li.appendChild(a);
            list.appendChild(li);
        });
    }

    return { generateToC };
}