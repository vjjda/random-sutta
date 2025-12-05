// Path: web/assets/modules/toh_component.js

// --- 1. Helper Function: Custom Smooth Scroll ---
function smoothScrollTo(element, duration = 800) {
    if (!element) return;

    const startPosition = window.scrollY || window.pageYOffset;
    const targetBounding = element.getBoundingClientRect();
    
    // Tính toán vị trí đích
    // [Tinh chỉnh] Offset 60px để chừa khoảng thở phía trên, tránh sát mép hoặc bị Header che
    const offset = 60; 
    const targetPosition = startPosition + targetBounding.top - offset;
    const distance = targetPosition - startPosition;
    
    let startTime = null;

    // Hàm Easing: easeInOutCubic (Chậm lúc đầu, nhanh ở giữa, chậm lúc cuối)
    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t * t + b;
        t -= 2;
        return c / 2 * (t * t * t + 2) + b;
    }

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        
        // Tính toán vị trí tiếp theo
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);

        // Tiếp tục animation nếu chưa hết thời gian
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            // Đảm bảo kết thúc chính xác tại đích
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

    /**
     * Hàm chính: Quét nội dung bài kinh và tạo danh sách headings
     */
    function generate() {
        // 1. Reset trạng thái
        list.innerHTML = "";
        menu.classList.add("hidden");
        fab.classList.remove("active");
        
        // 2. Tìm Heading (h2, h3, h4, h5) trong #sutta-container
        const headings = container.querySelectorAll("h1, h2, h3, h4, h5");
        if (headings.length < 2) {
            wrapper.classList.add("hidden");
            return;
        }

        wrapper.classList.remove("hidden");

        // 3. Build List
        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = `toh-heading-${index}`;
            }

            const li = document.createElement("li");
            li.className = `toh-item toh-${heading.tagName.toLowerCase()}`;
            
            const span = document.createElement("span"); 
            span.className = "toh-link";
            
            // Logic chọn text thông minh
            const engNode = heading.querySelector(".eng");
            const pliNode = heading.querySelector(".pli");
            
            let labelText = heading.textContent; // Mặc định (fallback)

            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }
            
            span.textContent = labelText.replace(/\s+/g, ' ').trim();
            
            // [UPDATED] Sử dụng Custom Smooth Scroll
            span.onclick = () => {
                // Thay thế scrollIntoView bằng hàm tự viết
                smoothScrollTo(heading, 800); // Thời gian 800ms
                
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}