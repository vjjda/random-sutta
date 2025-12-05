// Path: web/assets/modules/toh_component.js

// --- 1. Helper Function: Fade & Jump Navigation ---
function fadeJumpTo(element) {
    if (!element) return;
    
    // Chúng ta sẽ animate toàn bộ container chứa nội dung bài kinh
    const container = document.getElementById("sutta-container");
    if (!container) return;

    // A. Tính toán vị trí đích
    // [UPDATED] Offset nhỏ (10px) để sát mép trên
    const offset = 10; 
    const startY = window.scrollY || window.pageYOffset;
    const rect = element.getBoundingClientRect();
    // Vị trí tuyệt đối = vị trí hiện tại + vị trí tương đối - offset
    const targetY = startY + rect.top - offset;

    // B. Xác định hướng di chuyển (Lên hay Xuống)
    const isGoingDown = targetY > startY;

    // C. Chọn Class Animation phù hợp
    // Nếu đi xuống: Nội dung cũ bay lên (Exit Up), Nội dung mới từ dưới lên (Enter Bottom)
    const exitClass = isGoingDown ? 'exit-up' : 'exit-down';
    const entryClass = isGoingDown ? 'enter-from-bottom' : 'enter-from-top';

    // --- BƯỚC 1: FADE OUT (Biến mất) ---
    // Thêm class transition để bắt đầu hiệu ứng mờ dần và dịch chuyển
    container.classList.add('nav-transitioning');
    
    // Force Reflow (Hack) để trình duyệt nhận diện trạng thái bắt đầu animation
    void container.offsetWidth; 
    
    // Áp dụng class thoát
    container.classList.add(exitClass);

    // --- BƯỚC 2: TELEPORT (Nhảy cóc) ---
    setTimeout(() => {
        // 2.1. Nhảy đến đích ngay lập tức (Native Scroll)
        window.scrollTo(0, targetY);

        // 2.2. Chuẩn bị trạng thái để Fade In
        // Tắt transition tạm thời để set vị trí khởi đầu của nội dung mới mà không bị "trượt"
        container.classList.remove('nav-transitioning'); 
        container.classList.remove(exitClass);
        
        // Đặt vị trí bắt đầu cho entry (VD: đang ở dưới đất để chuẩn bị bay lên)
        container.classList.add(entryClass);

        // --- BƯỚC 3: FADE IN (Hiện lại) ---
        requestAnimationFrame(() => {
            // Bật lại transition
            requestAnimationFrame(() => {
                container.classList.add('nav-transitioning');
                // Xóa class entry để container trượt về vị trí mặc định (opacity 1, translate 0)
                container.classList.remove(entryClass);
                
                // Dọn dẹp class sau khi animation kết thúc
                setTimeout(() => {
                    container.classList.remove('nav-transitioning');
                }, 150);
            });
        });

    }, 150); 
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
                fadeJumpTo(heading);
                
                menu.classList.add("hidden");
                fab.classList.remove("active");
            };

            li.appendChild(span);
            list.appendChild(li);
        });
    }

    return { generate };
}