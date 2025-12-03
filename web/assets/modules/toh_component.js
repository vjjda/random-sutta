// Path: web/assets/modules/toh_component.js

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
            
            // [FIXED] Logic chọn text thông minh hơn để tránh duplicate
            // Ưu tiên lấy tiếng Anh (.eng), nếu không có thì lấy tiếng Pali (.pli),
            // đường cùng mới lấy toàn bộ textContent.
            const engNode = heading.querySelector(".eng");
            const pliNode = heading.querySelector(".pli");
            
            let labelText = heading.textContent; // Mặc định (fallback)

            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }
            
            // Làm sạch text (nếu cần thiết, ví dụ bỏ khoảng trắng thừa)
            span.textContent = labelText.replace(/\s+/g, ' ').trim();
            
            span.onclick = () => {
                heading.scrollIntoView({ behavior: "smooth", block: "start" });
                
                heading.classList.add("highlight");
                setTimeout(() => heading.classList.remove("highlight"), 2000);
                
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}