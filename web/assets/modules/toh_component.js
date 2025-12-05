// Path: web/assets/modules/toh_component.js

// --- 1. Helper Function: Custom Smooth Scroll ---
function smoothScrollTo(element, duration = 800) {
    if (!element) return;

    const startPosition = window.scrollY || window.pageYOffset;
    const targetBounding = element.getBoundingClientRect();
    const offset = 60; 
    const targetPosition = startPosition + targetBounding.top - offset;
    const distance = targetPosition - startPosition;
    
    let startTime = null;

    // [UPDATED] Hàm EaseOutExpo: Nhanh ở đầu, đỗ từ từ ở cuối -> Cảm giác nhẹ như bay
    function ease(t, b, c, d) {
        return (t === d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
    }

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);

        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            window.scrollTo(0, targetPosition);
        }
    }

    requestAnimationFrame(animation);
}

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
            
            const engNode = heading.querySelector(".eng");
            const pliNode = heading.querySelector(".pli");
            
            let labelText = heading.textContent;

            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }
            
            span.textContent = labelText.replace(/\s+/g, ' ').trim();
            
            span.onclick = () => {
                // [UPDATED] Giảm thời gian xuống 400ms cho cảm giác "Snap" nhanh gọn
                smoothScrollTo(heading, 400); 
                
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}