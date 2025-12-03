// Path: web/assets/modules/toh_component.js

export function setupTableOfHeadings() {
    const wrapper = document.getElementById("toh-wrapper");
    const fab = document.getElementById("toh-fab");
    const menu = document.getElementById("toh-menu");
    const list = document.getElementById("toh-list");
    const container = document.getElementById("sutta-container");

    // Nếu thiếu DOM thì trả về hàm rỗng để không gây lỗi logic ở nơi gọi
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
        
        // 2. Tìm Heading (h2, h3, h4) trong #sutta-container
        // Bỏ qua h1 (thường là tiêu đề bài kinh đã có trên top nav)
        const headings = container.querySelectorAll("h2, h3, h4", "h5");

        // Nếu bài kinh quá ngắn (ít hơn 2 mục), ẩn luôn nút ToH
        if (headings.length < 2) {
            wrapper.classList.add("hidden");
            return;
        }

        // Hiện nút nếu có dữ liệu
        wrapper.classList.remove("hidden");

        // 3. Build List
        headings.forEach((heading, index) => {
            // Đảm bảo heading có ID để neo
            if (!heading.id) {
                heading.id = `toh-heading-${index}`;
            }

            const li = document.createElement("li");
            // Class để style indent: toh-h2, toh-h3...
            li.className = `toh-item toh-${heading.tagName.toLowerCase()}`;
            
            const span = document.createElement("span"); 
            span.className = "toh-link";
            span.textContent = heading.textContent;
            
            // Xử lý click cuộn mượt
            span.onclick = () => {
                heading.scrollIntoView({ behavior: "smooth", block: "center" });
                
                // Hiệu ứng highlight heading mục tiêu
                heading.classList.add("highlight");
                setTimeout(() => heading.classList.remove("highlight"), 2000);
                
                // Đóng menu (đặc biệt quan trọng trên mobile)
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}