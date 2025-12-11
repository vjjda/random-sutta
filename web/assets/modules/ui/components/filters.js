// Path: web/assets/modules/ui/components/filters.js
import { PRIMARY_BOOKS, SECONDARY_BOOKS } from '../../data/constants.js';
import { Router } from '../../core/router.js';

const filterSet = new Set();
let isDragging = false;
let dragTargetState = true; 
let longPressTimer = null; // [NEW] Timer cho Long Press

export function getActiveFilters() {
  return Array.from(filterSet);
}

export function generateBookParam() {
  const active = Array.from(filterSet);
  const defaults = PRIMARY_BOOKS;
  
  // Nếu active rỗng -> Trả về null (để Router xóa param ?b=, kích hoạt Total Random)
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

  // [UPDATED] Đã XÓA đoạn logic chặn tắt nút cuối cùng
  // if (!newState && filterSet.size <= 1 && currentState) return; 

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

// [NEW] Chế độ Solo: Tắt hết, chỉ bật 1 cái
function setSoloFilter(targetBookId) {
    // 1. Logic Data
    filterSet.clear();
    filterSet.add(targetBookId);

    // 2. Logic UI (Update toàn bộ nút)
    const allBtns = document.querySelectorAll('.filter-btn');
    allBtns.forEach(btn => {
        if (btn.dataset.bookId === targetBookId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 3. Router
    const bookParam = generateBookParam();
    Router.updateURL(null, bookParam);
    
    // Rung nhẹ phản hồi (nếu thiết bị hỗ trợ)
    if (navigator.vibrate) navigator.vibrate(50);
}

function createFilterButton(bookId, container, isDefaultActive) {
  const btn = document.createElement("button");
  btn.className = "filter-btn";
  btn.style.touchAction = "pan-y"; 
  btn.dataset.bookId = bookId;

  if (["dn", "mn", "sn", "an"].includes(bookId)) {
    btn.textContent = bookId.toUpperCase();
  } else {
    btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
  }

  if (isDefaultActive) {
    btn.classList.add("active");
    filterSet.add(bookId);
  }

  // --- LOGIC SWIPE + LONG PRESS ---

  const startDrag = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    
    // [NEW] Setup Long Press Timer (800ms)
    longPressTimer = setTimeout(() => {
        // Nếu timer chạy xong tức là người dùng vẫn giữ tay -> Kích hoạt Solo
        setSoloFilter(bookId);
        isDragging = false; // Ngắt trạng thái drag để không update lại khi thả tay
    }, 800);

    // Vẫn thực hiện toggle ngay lập tức cho phản hồi nhanh (Snappy UI)
    // (Nếu sau đó Long Press kích hoạt, nó sẽ override trạng thái này)
    const currentActive = filterSet.has(bookId);
    dragTargetState = !currentActive;
    updateBookState(bookId, btn, dragTargetState, false); 
  };

  const onEnter = (e) => {
    if (isDragging) {
      // Nếu di chuột sang nút khác -> Hủy Long Press của nút cũ
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

function setupGlobalDragHandlers() {
    const endDrag = () => {
        // [NEW] Luôn xóa timer khi thả tay
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
        // [NEW] Nếu di chuyển ngón tay -> Hủy Long Press (chuyển sang thao tác cuộn hoặc swipe)
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

export function initFilters() {
  const primaryDiv = document.getElementById("primary-filters");
  const secondaryDiv = document.getElementById("secondary-filters");
  const moreBtn = document.getElementById("btn-more-filters");

  if (!primaryDiv || !secondaryDiv) return;

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
    // Mặc định ban đầu vẫn chọn Primary
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