// Path: web/assets/modules/ui/components/filters.js
import { PRIMARY_BOOKS, SECONDARY_BOOKS } from '../../data/constants.js';
import { Router } from '../../core/router.js';

const filterSet = new Set();
let isDragging = false;
let dragTargetState = true; // true = force Turn ON, false = force Turn OFF

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
    if (!activeSetCheck.has(book)) return active.join(",");
  }
  return null;
}

/**
 * Toggle trạng thái một cuốn sách (Visual Only hoặc Full Update)
 * @param {string} bookId 
 * @param {HTMLElement} btnElement 
 * @param {boolean|null} forceState - Nếu null thì toggle đảo chiều, nếu true/false thì ép trạng thái
 * @param {boolean} updateRouter - Có cập nhật URL ngay không? (False khi đang drag)
 */
function updateBookState(bookId, btnElement, forceState = null, updateRouter = true) {
  const currentState = filterSet.has(bookId);
  const newState = (forceState !== null) ? forceState : !currentState;

  // Nếu trạng thái không đổi thì không làm gì (tối ưu khi drag qua lại)
  if (currentState === newState) return;

  // Logic an toàn: Không cho phép tắt hết tất cả (giữ lại ít nhất 1)
  if (!newState && filterSet.size <= 1 && currentState) {
      return; 
  }

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

function createFilterButton(bookId, container, isDefaultActive) {
  const btn = document.createElement("button");
  btn.className = "filter-btn";
  // Thêm thuộc tính này để CSS có thể chặn scroll trình duyệt khi touch nếu cần
  btn.style.touchAction = "pan-y"; 
  btn.dataset.bookId = bookId; // Để truy xuất ID khi dùng elementFromPoint

  if (["dn", "mn", "sn", "an"].includes(bookId)) {
    btn.textContent = bookId.toUpperCase();
  } else {
    btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
  }

  if (isDefaultActive) {
    btn.classList.add("active");
    filterSet.add(bookId);
  }

  // --- LOGIC SWIPE / DRAG TO TOGGLE ---

  // 1. Mouse/Touch Down: Bắt đầu phiên kéo
  const startDrag = (e) => {
    // Chỉ xử lý chuột trái hoặc touch
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    
    // Xác định trạng thái mục tiêu dựa trên nút đầu tiên được bấm
    // Nếu nút đang bật -> Mục tiêu là Tắt (và ngược lại)
    const currentActive = filterSet.has(bookId);
    dragTargetState = !currentActive;

    // Áp dụng ngay cho nút đầu tiên
    updateBookState(bookId, btn, dragTargetState, false); // false = chưa update URL
  };

  // 2. Mouse Enter: Xử lý khi chuột lướt qua nút khác (Desktop)
  const onEnter = (e) => {
    if (isDragging) {
      updateBookState(bookId, btn, dragTargetState, false);
    }
  };

  btn.addEventListener("mousedown", startDrag);
  btn.addEventListener("touchstart", startDrag, { passive: true });
  btn.addEventListener("mouseenter", onEnter);

  // Click thuần túy (để đảm bảo update URL nếu chỉ click 1 cái rồi thả)
  btn.addEventListener("click", (e) => {
      // Logic click đã được xử lý ở mousedown/mouseup global, 
      // ta prevent default click để tránh conflict
      e.preventDefault();
  });

  container.appendChild(btn);
}

/**
 * Xử lý global events để hỗ trợ Touch Drag (Mobile) và Mouse Up
 */
function setupGlobalDragHandlers() {
    // Global Up: Kết thúc kéo -> Cập nhật URL 1 lần duy nhất
    const endDrag = () => {
        if (isDragging) {
            isDragging = false;
            const bookParam = generateBookParam();
            Router.updateURL(null, bookParam);
        }
    };

    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchend", endDrag);

    // Global Touch Move: Mobile không có 'mouseenter', phải tính toán tọa độ
    window.addEventListener("touchmove", (e) => {
        if (!isDragging) return;

        // Lấy phần tử tại vị trí ngón tay
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        if (target && target.classList.contains("filter-btn")) {
            const bId = target.dataset.bookId;
            if (bId) {
                updateBookState(bId, target, dragTargetState, false);
            }
        }
    }, { passive: true }); // passive true để vẫn cho phép scroll màn hình nếu vuốt dọc
}

export function initFilters() {
  const primaryDiv = document.getElementById("primary-filters");
  const secondaryDiv = document.getElementById("secondary-filters");
  const moreBtn = document.getElementById("btn-more-filters");

  if (!primaryDiv || !secondaryDiv) return;

  // Setup Global Listeners (Chỉ chạy 1 lần)
  if (!window._filterDragSetup) {
      setupGlobalDragHandlers();
      window._filterDragSetup = true;
  }

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