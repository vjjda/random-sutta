// Path: web/assets/modules/filters.js

const filterSet = new Set();

window.getActiveFilters = function () {
  return Array.from(filterSet);
};

// NEW: Hàm tính toán tham số URL cho sách (Chuyển từ app.js sang)
window.generateBookParam = function () {
  const active = Array.from(filterSet);
  const defaults = window.PRIMARY_BOOKS;

  // 1. Nếu số lượng khác nhau -> Custom
  if (active.length !== defaults.length) {
    return active.join(",");
  }

  // 2. Nếu số lượng bằng, check nội dung
  const activeSetCheck = new Set(active);
  for (let book of defaults) {
    if (!activeSetCheck.has(book)) {
      return active.join(","); // Có sách lạ
    }
  }

  // 3. Giống hệt default -> null
  return null;
};

function toggleFilter(bookId, btnElement) {
  if (filterSet.has(bookId)) {
    if (filterSet.size === 1) return; // Giữ ít nhất 1
    filterSet.delete(bookId);
    btnElement.classList.remove("active");
  } else {
    filterSet.add(bookId);
    btnElement.classList.add("active");
  }

  // UPDATED: Cập nhật URL ngay lập tức
  const bookParam = window.generateBookParam();
  // Truyền null vào tham số đầu tiên để giữ nguyên Sutta ID hiện tại
  window.updateURL(null, bookParam);
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

window.initFilters = function () {
  const primaryDiv = document.getElementById("primary-filters");
  const secondaryDiv = document.getElementById("secondary-filters");
  const moreBtn = document.getElementById("btn-more-filters");

  primaryDiv.innerHTML = "";
  secondaryDiv.innerHTML = "";

  filterSet.clear();

  // Parse URL param ?b= để init state
  const params = new URLSearchParams(window.location.search);
  const bParam = params.get("b");

  let initialBooks = new Set();
  let hasSecondaryActive = false;

  if (bParam) {
    const booksFromUrl = bParam
      .toLowerCase()
      .split(",")
      .map((s) => s.trim());
    booksFromUrl.forEach((b) => initialBooks.add(b));
  } else {
    window.PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
  }

  // Render Primary
  window.PRIMARY_BOOKS.forEach((book) => {
    const isActive = initialBooks.has(book);
    createFilterButton(book, primaryDiv, isActive);
  });

  // Render Secondary
  window.SECONDARY_BOOKS.forEach((book) => {
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
    moreBtn.textContent = secondaryDiv.classList.contains("hidden")
      ? "Others"
      : "Hide";
  };
};
