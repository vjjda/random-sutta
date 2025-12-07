// Path: web/assets/modules/ui/toh_component.js
import { Scroller } from './scroller.js';

export function setupTableOfHeadings() {
    // ... (Giữ nguyên phần khai báo biến) ...
    const wrapper = document.getElementById("toh-wrapper");
    const fab = document.getElementById("toh-fab");
    const menu = document.getElementById("toh-menu");
    const list = document.getElementById("toh-list");
    const container = document.getElementById("sutta-container");

    if (!wrapper || !fab || !menu || !list || !container) {
        return { generate: () => {} };
    }

    // ... (Giữ nguyên event listener của Menu) ...
    fab.onclick = (e) => {
        menu.classList.toggle("hidden");
        fab.classList.toggle("active");
        e.stopPropagation();
    };
    
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
            
            let labelText = heading.textContent;
            const engNode = heading.querySelector(".eng");
            const pliNode = heading.querySelector(".pli");
            
            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }
            
            span.textContent = labelText.replace(/\s+/g, ' ').trim();
            
            // [FIX] Click Handler dùng Animation
            span.onclick = () => {
                // Sử dụng hàm mới để có hiệu ứng Fade -> Jump -> Fade
                Scroller.animateScrollTo(heading.id);
                
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}