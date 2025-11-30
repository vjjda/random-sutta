// Path: web/assets/modules/filters.js

const filterSet = new Set();

window.getActiveFilters = function() {
    return Array.from(filterSet);
}

function toggleFilter(bookId, btnElement) {
    if (filterSet.has(bookId)) {
        if (filterSet.size === 1) return;
        filterSet.delete(bookId);
        btnElement.classList.remove("active");
    } else {
        filterSet.add(bookId);
        btnElement.classList.add("active");
    }
}

function createFilterButton(bookId, container, isActive) {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    
    if (['dn', 'mn', 'sn', 'an'].includes(bookId)) {
        btn.textContent = bookId.toUpperCase();
    } else {
        btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
    }
    
    // Set trạng thái dựa trên tham số isActive được truyền vào
    if (isActive) {
        btn.classList.add("active");
        filterSet.add(bookId);
    }

    btn.addEventListener("click", () => toggleFilter(bookId, btn));
    container.appendChild(btn);
}

window.initFilters = function() {
    const primaryDiv = document.getElementById("primary-filters");
    const secondaryDiv = document.getElementById("secondary-filters");
    const moreBtn = document.getElementById("btn-more-filters");

    primaryDiv.innerHTML = "";
    secondaryDiv.innerHTML = "";

    // Reset bộ lọc
    filterSet.clear();

    // --- XỬ LÝ URL PARAM ?b=... ---
    const params = new URLSearchParams(window.location.search);
    const bParam = params.get("b");

    let initialBooks = new Set();
    let hasSecondaryActive = false; // Cờ kiểm tra xem có sách phụ nào được chọn không

    if (bParam) {
        // Nếu có ?b=mn,dn -> Tách chuỗi và lấy danh sách
        const booksFromUrl = bParam.toLowerCase().split(",").map(s => s.trim());
        booksFromUrl.forEach(b => initialBooks.add(b));
    } else {
        // Nếu không có ?b= -> Mặc định chọn Primary Books
        window.PRIMARY_BOOKS.forEach(b => initialBooks.add(b));
    }

    // --- RENDER PRIMARY ---
    window.PRIMARY_BOOKS.forEach(book => {
        const isActive = initialBooks.has(book);
        createFilterButton(book, primaryDiv, isActive);
    });

    // --- RENDER SECONDARY ---
    window.SECONDARY_BOOKS.forEach(book => {
        const isActive = initialBooks.has(book);
        if (isActive) hasSecondaryActive = true;
        createFilterButton(book, secondaryDiv, isActive);
    });

    // --- LOGIC MỞ RỘNG AUTO ---
    // Nếu trong URL có yêu cầu sách thuộc nhóm Secondary (ví dụ ?b=dhp,bv), 
    // ta tự động mở rộng panel "Others" để người dùng thấy nút đang active.
    if (hasSecondaryActive) {
        secondaryDiv.classList.remove("hidden");
        moreBtn.textContent = "Hide";
    } else {
        // Mặc định ẩn
        secondaryDiv.classList.add("hidden");
        moreBtn.textContent = "Others";
    }

    // Toggle button logic
    moreBtn.onclick = () => { // Dùng onclick để override event cũ nếu hàm này chạy nhiều lần
        secondaryDiv.classList.toggle("hidden");
        moreBtn.textContent = secondaryDiv.classList.contains("hidden") 
            ? "Others" 
            : "Hide";
    };
}