// Path: web/assets/modules/filters.js

// Biến này ở global scope của file này, không cần window nhưng các hàm khác phải gắn window
const filterSet = new Set(); 
// Lưu ý: chưa init Set ngay vì PRIMARY_BOOKS có thể chưa load xong nếu thứ tự script sai.
// Ta sẽ init trong initFilters

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

window.initFilters = function() {
    const primaryDiv = document.getElementById("primary-filters");
    const secondaryDiv = document.getElementById("secondary-filters");
    const moreBtn = document.getElementById("btn-more-filters");

    primaryDiv.innerHTML = "";
    secondaryDiv.innerHTML = "";

    // Reset và Init Set từ biến toàn cục
    filterSet.clear();
    
    // Render
    window.PRIMARY_BOOKS.forEach(book => createFilterButton(book, primaryDiv, true));
    window.SECONDARY_BOOKS.forEach(book => createFilterButton(book, secondaryDiv, false));

    moreBtn.addEventListener("click", () => {
        secondaryDiv.classList.toggle("hidden");
        moreBtn.textContent = secondaryDiv.classList.contains("hidden") 
            ? "Others" 
            : "Hide";
    });
}