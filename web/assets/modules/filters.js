// Path: web/assets/modules/filters.js
// Xóa dòng import vì PRIMARY_BOOKS đã là biến toàn cục

// Đổi tên activeFilters thành biến global filterSet để tránh trùng lặp nếu cần, 
// nhưng trong trường hợp này ta để nguyên vì file load tuần tự.
const filterSet = new Set(PRIMARY_BOOKS);

function getActiveFilters() {
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

function createFilterButton(bookId, container, isDefaultActive) {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    
    if (['dn', 'mn', 'sn', 'an'].includes(bookId)) {
        btn.textContent = bookId.toUpperCase();
    } else {
        btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
    }
    
    if (isDefaultActive) {
        btn.classList.add("active");
        filterSet.add(bookId);
    }

    btn.addEventListener("click", () => toggleFilter(bookId, btn));
    container.appendChild(btn);
}

function initFilters() {
    const primaryDiv = document.getElementById("primary-filters");
    const secondaryDiv = document.getElementById("secondary-filters");
    const moreBtn = document.getElementById("btn-more-filters");

    primaryDiv.innerHTML = "";
    secondaryDiv.innerHTML = "";

    filterSet.clear();
    PRIMARY_BOOKS.forEach(b => filterSet.add(b));

    PRIMARY_BOOKS.forEach(book => createFilterButton(book, primaryDiv, true));
    SECONDARY_BOOKS.forEach(book => createFilterButton(book, secondaryDiv, false));

    moreBtn.addEventListener("click", () => {
        secondaryDiv.classList.toggle("hidden");
        moreBtn.textContent = secondaryDiv.classList.contains("hidden") 
            ? "Others" 
            : "Hide";
    });
}