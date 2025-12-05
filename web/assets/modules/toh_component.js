// Path: web/assets/modules/toh_component.js

// --- 1. Helper Function: Fade & Jump Navigation ---
function fadeJumpTo(element) {
    if (!element) return;
    
    const container = document.getElementById("sutta-container");
    if (!container) return;

    // A. Tính toán vị trí đích
    // [UPDATED] Giảm offset từ 60 xuống 10 để sát mép trên hơn
    const offset = 10; 
    const startY = window.scrollY || window.pageYOffset;
    const rect = element.getBoundingClientRect();
    // Vị trí tuyệt đối = vị trí hiện tại + vị trí tương đối trong viewport - offset
    const targetY = startY + rect.top - offset;

    // B. Xác định hướng di chuyển (Lên hay Xuống)
    const isGoingDown = targetY > startY;

    // C. Chuẩn bị Class Animation
    const exitClass = isGoingDown ? 'exit-up' : 'exit-down';
    const entryClass = isGoingDown ? 'enter-from-bottom' : 'enter-from-top';

    // --- BƯỚC 1: FADE OUT (Biến mất theo hướng) ---
    container.classList.add('nav-transitioning');
    
    // Force Reflow để browser nhận diện trạng thái ban đầu
    void container.offsetWidth; 
    
    container.classList.add(exitClass);

    // --- BƯỚC 2: TELEPORT (Sau khi fade out xong - 250ms) ---
    setTimeout(() => {
        // 2.1. Nhảy đến đích ngay lập tức
        window.scrollTo(0, targetY);

        // 2.2. Chuẩn bị trạng thái để Fade In
        // Tắt transition tạm thời để set vị trí bắt đầu của nội dung mới mà không bị animation
        container.classList.remove('nav-transitioning'); 
        container.classList.remove(exitClass);
        
        // Đặt vị trí bắt đầu cho entry (ví dụ: đang ở dưới đất để chuẩn bị bay lên)
        container.classList.add(entryClass);

        // --- BƯỚC 3: FADE IN (Hiện lại) ---
        requestAnimationFrame(() => {
            // Bật lại transition
            container.classList.add('nav-transitioning');
            
            requestAnimationFrame(() => {
                // Xóa class entry để nó trượt về vị trí 0 (reset-transform)
                container.classList.remove(entryClass);
                
                // Dọn dẹp sau khi animation kết thúc
                setTimeout(() => {
                    container.classList.remove('nav-transitioning');
                }, 250);
            });
        });

    }, 250); // Thời gian khớp với CSS transition
}

// --- 2. Main Component ---
export function setupTableOfHeadings() {
    // ... (Giữ nguyên phần khai báo biến wrapper, fab, menu...)
    const wrapper = document.getElementById("toh-wrapper");
    const fab = document.getElementById("toh-fab");
    const menu = document.getElementById("toh-menu");
    const list = document.getElementById("toh-list");
    const container = document.getElementById("sutta-container");

    if (!wrapper || !fab || !menu || !list || !container) {
        console.warn("ToH: DOM elements missing.");
        return { generate: () => {} };
    }

    // ... (Giữ nguyên phần Event Listener cho fab và document click) ...
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
                // [UPDATED] Sử dụng hàm fadeJumpTo mới thay cho smoothScrollTo
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