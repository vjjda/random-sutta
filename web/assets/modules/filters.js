// Path: web/assets/modules/filters.js
import { PRIMARY_BOOKS, SECONDARY_BOOKS } from './constants.js';

// State nội bộ của module
const activeFilters = new Set(PRIMARY_BOOKS);

export function getActiveFilters() {
    return Array.from(activeFilters);
}

function toggleFilter(bookId, btnElement) {
    if (activeFilters.has(bookId)) {
        // Giữ lại ít nhất 1 filter
        if (activeFilters.size === 1) return;
        activeFilters.delete(bookId);
        btnElement.classList.remove("active");
    } else {
        activeFilters.add(bookId);
        btnElement.classList.add("active");
    }
}

function createFilterButton(bookId, container, isDefaultActive) {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    
    // Logic viết hoa: DN, MN, SN, AN -> Uppercase; còn lại Titlecase
    if (['dn', 'mn', 'sn', 'an'].includes(bookId)) {
        btn.textContent = bookId.toUpperCase();
    } else {
        btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
    }
    
    if (isDefaultActive) {
        btn.classList.add("active");
        activeFilters.add(bookId); // Đảm bảo sync state
    }

    btn.addEventListener("click", () => toggleFilter(bookId, btn));
    container.appendChild(btn);
}

export function initFilters() {
    const primaryDiv = document.getElementById("primary-filters");
    const secondaryDiv = document.getElementById("secondary-filters");
    const moreBtn = document.getElementById("btn-more-filters");

    primaryDiv.innerHTML = "";
    secondaryDiv.innerHTML = "";

    // Reset state về mặc định trước khi render
    activeFilters.clear();
    PRIMARY_BOOKS.forEach(b => activeFilters.add(b));

    PRIMARY_BOOKS.forEach(book => createFilterButton(book, primaryDiv, true));
    SECONDARY_BOOKS.forEach(book => createFilterButton(book, secondaryDiv, false));

    moreBtn.addEventListener("click", () => {
        secondaryDiv.classList.toggle("hidden");
        moreBtn.textContent = secondaryDiv.classList.contains("hidden") 
            ? "Others" 
            : "Hide";
    });
}