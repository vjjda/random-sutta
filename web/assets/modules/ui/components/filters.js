// Path: web/assets/modules/ui/components/filters.js

// [FIXED] Đường dẫn import phải lùi 2 cấp (../../) để ra khỏi 'components' và 'ui'
import { PRIMARY_BOOKS, SECONDARY_BOOKS } from '../../data/constants.js'; 
import { Router } from '../../core/router.js'; // [FIXED] Cũng cần sửa path về core

const filterSet = new Set();

export function getActiveFilters() {
  return Array.from(filterSet);
}

export function generateBookParam() {
  const active = Array.from(filterSet);
  const defaults = PRIMARY_BOOKS;

  if (active.length !== defaults.length) {
    return active.join(",");
  }

  const activeSetCheck = new Set(active);
  for (let book of defaults) {
    if (!activeSetCheck.has(book)) {
      return active.join(",");
    }
  }
  return null;
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

  const bookParam = generateBookParam();
  // Giữ nguyên sutta hiện tại (null param đầu), chỉ update ?b=
  Router.updateURL(null, bookParam);
}

function createFilterButton(bookId, container, isDefaultActive) {
  const btn = document.createElement("button");
  btn.className = "filter-btn";
  
  if (["dn", "mn", "sn", "an"].includes(bookId)) {
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

export function initFilters() {
  const primaryDiv = document.getElementById("primary-filters");
  const secondaryDiv = document.getElementById("secondary-filters");
  const moreBtn = document.getElementById("btn-more-filters");

  if (!primaryDiv || !secondaryDiv) return;

  primaryDiv.innerHTML = "";
  secondaryDiv.innerHTML = "";
  filterSet.clear();

  const params = new URLSearchParams(window.location.search);
  const bParam = params.get("b");
  let initialBooks = new Set();
  let hasSecondaryActive = false;

  if (bParam) {
    const booksFromUrl = bParam.toLowerCase().split(",").map((s) => s.trim());
    booksFromUrl.forEach((b) => initialBooks.add(b));
  } else {
    PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
  }

  PRIMARY_BOOKS.forEach((book) => {
    const isActive = initialBooks.has(book);
    createFilterButton(book, primaryDiv, isActive);
  });

  SECONDARY_BOOKS.forEach((book) => {
    const isActive = initialBooks.has(book);
    if (isActive) hasSecondaryActive = true;
    createFilterButton(book, secondaryDiv, isActive);
  });

  if (hasSecondaryActive) {
    secondaryDiv.classList.remove("hidden");
    moreBtn.textContent = "Hide";
  } else {
    secondaryDiv.classList.add("hidden");
    moreBtn.textContent = "Others";
  }

  moreBtn.onclick = () => {
    secondaryDiv.classList.toggle("hidden");
    moreBtn.textContent = secondaryDiv.classList.contains("hidden") ? "Others" : "Hide";
  };
}