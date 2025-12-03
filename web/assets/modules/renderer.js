// Path: web/assets/modules/renderer.js

// Hàm helper nội bộ để update header (Title/Subtitle)
function updateTopNavLocal(currentId, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");
  
  const currentInfo = window.getSuttaDisplayInfo(currentId);

  // 1. Cập nhật Text Content
  if (navMainTitle) navMainTitle.textContent = currentInfo.title;
  if (navSubTitle) navSubTitle.textContent = currentInfo.subtitle;

  // 2. RESET UI: Luôn quay về chế độ Text khi tải bài mới
  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  if (textMode && inputMode) {
    textMode.classList.remove("hidden");
    inputMode.classList.add("hidden");
  }

  // 3. Cập nhật nút Next/Prev
  if (prevId) {
    navPrevBtn.disabled = false;
    navPrevBtn.onclick = () => window.loadSutta(prevId);
    navPrevBtn.title = `Previous: ${window.getSuttaDisplayInfo(prevId).title}`;
  } else {
    navPrevBtn.disabled = true;
    navPrevBtn.onclick = null;
    navPrevBtn.title = "";
  }

  if (nextId) {
    navNextBtn.disabled = false;
    navNextBtn.onclick = () => window.loadSutta(nextId);
    navNextBtn.title = `Next: ${window.getSuttaDisplayInfo(nextId).title}`;
  } else {
    navNextBtn.disabled = true;
    navNextBtn.onclick = null;
    navNextBtn.title = "";
  }

  navHeader.classList.remove("hidden");
  statusDiv.classList.add("hidden");
}

// --- [RESTORED] TÍNH NĂNG QUICK NAV ---
window.setupQuickNav = function () {
  const displayContainer = document.getElementById("nav-title-display");
  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  const inputField = document.getElementById("nav-sutta-input");
  const goBtn = document.getElementById("nav-search-btn");

  if (!displayContainer || !textMode || !inputMode) return;

  // 1. Chuyển sang Input Mode khi click vào tiêu đề
  displayContainer.addEventListener("click", (e) => {
    // Bỏ qua nếu đang click vào chính input hoặc nút Go
    if (e.target === inputField || e.target === goBtn || inputMode.contains(e.target)) {
      return;
    }

    textMode.classList.add("hidden");
    inputMode.classList.remove("hidden");
    
    // Reset và Focus
    inputField.value = ""; 
    inputField.focus();
  });

  // 2. Thực hiện Search
  const performSearch = () => {
    const query = inputField.value.trim().toLowerCase().replace(/\s/g, "");
    if (!query) {
      cancelSearch();
      return;
    }

    // Gọi loadSutta từ app.js (Hàm này đã có logic tự tìm và tải sách nếu thiếu)
    if (window.loadSutta) {
        window.loadSutta(query);
    } else {
        console.error("loadSutta function missing");
    }
    
    // Ẩn input ngay lập tức cho mượt
    cancelSearch();
  };

  // 3. Hủy Search (Quay lại Text Mode)
  const cancelSearch = () => {
    inputMode.classList.add("hidden");
    textMode.classList.remove("hidden");
  };

  // Event Listeners
  goBtn.addEventListener("click", performSearch);

  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performSearch();
    if (e.key === "Escape") {
      cancelSearch();
      e.stopPropagation();
    }
  });

  // Xử lý khi click ra ngoài (Blur)
  inputField.addEventListener("blur", (e) => {
    setTimeout(() => {
      // Kiểm tra xem focus có chuyển sang phần tử con nào của inputMode không (ví dụ nút Go)
      if (!inputMode.contains(document.activeElement)) {
        cancelSearch();
      }
    }, 150);
  });
};

// Hàm render chính
window.renderSutta = function (suttaId, checkHash = true) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");

  const id = suttaId.toLowerCase().trim();
  
  // 1. Kiểm tra xem sách chứa bài kinh này đã load chưa
  const book = window.DB.findBookContaining(id);

  if (!book) {
    container.innerHTML = `<p class="placeholder" style="color:red">Sutta ID "<b>${id}</b>" not found in loaded books.</p>`;
    statusDiv.textContent = "Error: Sutta not found.";
    statusDiv.classList.remove("hidden");
    navHeader.classList.add("hidden");
    return false;
  }

  // 2. Tính toán Navigation (Prev/Next) từ DB Structure
  const nav = window.DB.getNavigation(id);
  updateTopNavLocal(id, nav.prev, nav.next);

  // 3. Compile HTML từ dữ liệu thô
  const htmlContent = window.DB.compileHtml(id);
  
  // 4. Render Bottom Nav
  let bottomNavHtml = '<div class="sutta-nav">';
  if (nav.prev) {
    const prevInfo = window.getSuttaDisplayInfo(nav.prev);
    bottomNavHtml += `<button onclick="window.loadSutta('${nav.prev}')" class="nav-btn">← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span></button>`;
  } else {
    bottomNavHtml += `<span></span>`;
  }
  if (nav.next) {
    const nextInfo = window.getSuttaDisplayInfo(nav.next);
    bottomNavHtml += `<button onclick="window.loadSutta('${nav.next}')" class="nav-btn">${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span></button>`;
  }
  bottomNavHtml += "</div>";

  container.innerHTML = htmlContent + bottomNavHtml;

  // 5. Xử lý Hash scroll
  const hash = window.location.hash;
  if (checkHash && hash) {
    const targetId = hash.substring(1);
    setTimeout(() => {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            targetElement.classList.add("highlight");
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, 0);
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return true;
};