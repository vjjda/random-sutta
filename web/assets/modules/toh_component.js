// Path: web/assets/modules/toh_component.js
import { Scroller } from './scroller.js';

// --- 1. Helper Function: Fade & Jump Navigation ---

// --- 2. Main Component ---
export function setupTableOfHeadings() {
    const wrapper = document.getElementById("toh-wrapper");
    const fab = document.getElementById("toh-fab");
    const menu = document.getElementById("toh-menu");
    const list = document.getElementById("toh-list");
    const container = document.getElementById("sutta-container");

    if (!wrapper || !fab || !menu || !list || !container) {
        console.warn("ToH: DOM elements missing.");
        return { generate: () => {} };
    }

    // Toggle Menu
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

    function generate() {
        list.innerHTML = "";
        menu.classList.add("hidden");
        fab.classList.remove("active");

        const headings = container.querySelectorAll("h1, h2, h3, h4, h5");
        
        // Nếu ít heading quá thì ẩn luôn ToH
        if (headings.length < 2) {
            wrapper.classList.add("hidden");
            return;
        }

        wrapper.classList.remove("hidden");

        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = `toh-heading-${index}`;
            }

            const li = document.createElement("li");
            li.className = `toh-item toh-${heading.tagName.toLowerCase()}`;
            
            const span = document.createElement("span"); 
            span.className = "toh-link";
            
            // Ưu tiên hiển thị tiếng Anh, sau đó đến Pali
            const engNode = heading.querySelector(".eng");
            const pliNode = heading.querySelector(".pli");
            
            let labelText = heading.textContent;

            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }
            
            span.textContent = labelText.replace(/\s+/g, ' ').trim();
            
            // Click Handler
            span.onclick = () => {
                // [UPDATED] Gọi hàm Fade Jump thay vì Scroll
                Scroller.scrollToId(heading.id);
                
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}