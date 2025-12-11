// Path: web/assets/modules/ui/components/filters.js
import { PRIMARY_BOOKS, SECONDARY_BOOKS } from '../../data/constants.js';
import { Router } from '../../core/router.js';

const filterSet = new Set();
let isDragging = false;
let dragTargetState = true; 
let longPressTimer = null;

// ... (Các hàm getActiveFilters, generateBookParam, updateBookState giữ nguyên) ...
export function getActiveFilters() {
  return Array.from(filterSet);
}

export function generateBookParam() {
  const active = Array.from(filterSet);
  const defaults = PRIMARY_BOOKS;
  
  if (active.length === 0) return null;

  if (active.length !== defaults.length) {
    return active.join(",");
  }

  const activeSetCheck = new Set(active);
  for (let book of defaults) {
    if (!activeSetCheck.has(book)) return active.join(",");
  }
  return null;
}

function updateBookState(bookId, btnElement, forceState = null, updateRouter = true) {
  const currentState = filterSet.has(bookId);
  const newState = (forceState !== null) ? forceState : !currentState;

  if (currentState === newState) return;

  if (newState) {
    filterSet.add(bookId);
    btnElement.classList.add("active");
  } else {
    filterSet.delete(bookId);
    btnElement.classList.remove("active");
  }

  if (updateRouter) {
    const bookParam = generateBookParam();
    Router.updateURL(null, bookParam);
  }
}

function setSoloFilter(targetBookId) {
    filterSet.clear();
    filterSet.add(targetBookId);

    const allBtns = document.querySelectorAll('.filter-btn');
    allBtns.forEach(btn => {
        if (btn.dataset.bookId === targetBookId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const bookParam = generateBookParam();
    Router.updateURL(null, bookParam);
    
    if (navigator.vibrate) navigator.vibrate(50);
}

function createFilterButton(bookId, container, isDefaultActive) {
  const btn = document.createElement("button");
  btn.className = "filter-btn";
  btn.style.touchAction = "pan-y"; 
  btn.dataset.bookId = bookId;

  // Capitalize logic: DN, MN, SN, AN -> Uppercase. Others -> Title Case.
  if (["dn", "mn", "sn", "an"].includes(bookId)) {
    btn.textContent = bookId.toUpperCase();
  } else {
    btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
  }

  if (isDefaultActive) {
    btn.classList.add("active");
    filterSet.add(bookId);
  }

  // --- LOGIC SWIPE + LONG PRESS (Giữ nguyên) ---
  const startDrag = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    
    longPressTimer = setTimeout(() => {
        setSoloFilter(bookId);
        isDragging = false;
    }, 800);

    const currentActive = filterSet.has(bookId);
    dragTargetState = !currentActive;
    updateBookState(bookId, btn, dragTargetState, false); 
  };

  const onEnter = (e) => {
    if (isDragging) {
      clearTimeout(longPressTimer); 
      updateBookState(bookId, btn, dragTargetState, false);
    }
  };

  btn.addEventListener("mousedown", startDrag);
  btn.addEventListener("touchstart", startDrag, { passive: true });
  btn.addEventListener("mouseenter", onEnter);

  btn.addEventListener("click", (e) => {
      e.preventDefault();
  });

  container.appendChild(btn);
}

// ... (Hàm setupGlobalDragHandlers giữ nguyên) ...
function setupGlobalDragHandlers() {
    const endDrag = () => {
        clearTimeout(longPressTimer);
        if (isDragging) {
            isDragging = false;
            const bookParam = generateBookParam();
            Router.updateURL(null, bookParam);
        }
    };

    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchend", endDrag);

    window.addEventListener("touchmove", (e) => {
        if (longPressTimer) clearTimeout(longPressTimer);
        if (!isDragging) return;

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        if (target && target.classList.contains("filter-btn")) {
            const bId = target.dataset.bookId;
            if (bId) {
                updateBookState(bId, target, dragTargetState, false);
            }
        }
    }, { passive: true });
}

// [UPDATED] Hàm initFilters với logic chia hàng
export function initFilters() {
  const primaryDiv = document.getElementById("primary-filters");
  const secondaryDiv = document.getElementById("secondary-filters");
  const moreBtn = document.getElementById("btn-more-filters");

  if (!primaryDiv || !secondaryDiv) return;

  if (!window._filterDragSetup) {
      setupGlobalDragHandlers();
      window._filterDragSetup = true;
  }

  // Reset content
  primaryDiv.innerHTML = "";
  secondaryDiv.innerHTML = "";
  filterSet.clear();
  
  // 1. Tạo 2 hàng riêng biệt cho Primary Filters
  // Hàng 1: Các bộ Nikaya chính (DN, MN, SN, AN)
  const rowNikayas = document.createElement("div");
  rowNikayas.className = "filter-row"; // Sử dụng lại class CSS có sẵn để căn giữa và gap

  // Hàng 2: Các cuốn còn lại (Tiểu bộ)
  const rowOthers = document.createElement("div");
  rowOthers.className = "filter-row";

  const params = new URLSearchParams(window.location.search);
  const bParam = params.get("b");
  let initialBooks = new Set();
  
  if (bParam) {
    const booksFromUrl = bParam.toLowerCase().split(",").map((s) => s.trim());
    booksFromUrl.forEach((b) => initialBooks.add(b));
  } else {
    PRIMARY_BOOKS.forEach((b) => initialBooks.add(b));
  }

  // Phân loại sách vào đúng hàng
  const mainNikayas = ["dn", "mn", "sn", "an"];

  PRIMARY_BOOKS.forEach((book) => {
    const isActive = initialBooks.has(book);
    if (mainNikayas.includes(book)) {
        createFilterButton(book, rowNikayas, isActive);
    } else {
        createFilterButton(book, rowOthers, isActive);
    }
  });

  // Append 2 hàng vào container chính
  primaryDiv.appendChild(rowNikayas);
  primaryDiv.appendChild(rowOthers);
  
  // Xử lý Secondary Books (Hàng ẩn)
  let hasSecondaryActive = false;
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