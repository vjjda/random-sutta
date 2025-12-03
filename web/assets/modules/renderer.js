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

// --- TÍNH NĂNG QUICK NAV ---
window.setupQuickNav = function () {
  const displayContainer = document.getElementById("nav-title-display");
  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  const inputField = document.getElementById("nav-sutta-input");
  const goBtn = document.getElementById("nav-search-btn");

  if (!displayContainer || !textMode || !inputMode) return;

  // [NEW] Hàm helper để kích hoạt chế độ tìm kiếm từ bên ngoài (API)
  window.activateSearchMode = function() {
      textMode.classList.add("hidden");
      inputMode.classList.remove("hidden");
      inputField.value = ""; 
      inputField.focus();
  };

  // 1. Chuyển sang Input Mode khi click vào tiêu đề
  displayContainer.addEventListener("click", (e) => {
    if (e.target === inputField || e.target === goBtn || inputMode.contains(e.target)) {
      return;
    }
    window.activateSearchMode();
  });

  // ... (Phần logic performSearch, cancelSearch, Event Listeners giữ nguyên) ...
  const performSearch = () => {
    const query = inputField.value.trim().toLowerCase().replace(/\s/g, "");
    if (!query) {
      cancelSearch();
      return;
    }
    if (window.loadSutta) {
        window.loadSutta(query);
    }
    cancelSearch();
  };

  const cancelSearch = () => {
    inputMode.classList.add("hidden");
    textMode.classList.remove("hidden");
  };

  goBtn.addEventListener("click", performSearch);

  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performSearch();
    if (e.key === "Escape") {
      cancelSearch();
      e.stopPropagation();
    }
  });

  inputField.addEventListener("blur", (e) => {
    setTimeout(() => {
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
  
  // 1. Kiểm tra sách
  const book = window.DB.findBookContaining(id);

  if (!book) {
    // [FIX] Thay đổi nội dung hiển thị lỗi: Có link SuttaCentral
    const scLink = `https://suttacentral.net/${id}/en/sujato`;
    
    container.innerHTML = `
        <div class="error-message">
            <p style="color: #d35400; font-weight: bold; font-size: 1.2rem;">
                Sutta ID "${id}" not found.
            </p>
            <p>You can try checking on SuttaCentral:</p>
            <p>
                <a href="${scLink}" target="_blank" rel="noopener noreferrer" class="sc-link">
                    SuttaCentral ➜
                </a>
            </p>
        </div>`;
        
    statusDiv.textContent = "Sutta not found.";
    statusDiv.classList.remove("hidden");
    navHeader.classList.remove("hidden");
    
    // Reset Title về trạng thái chờ
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    if(navMainTitle) navMainTitle.textContent = "Not Found";
    if(navSubTitle) navSubTitle.textContent = "---";
    
    return false;
  }

  // ... (Phần logic render thành công phía dưới giữ nguyên) ...
  const nav = window.DB.getNavigation(id);
  updateTopNavLocal(id, nav.prev, nav.next);

  const htmlContent = window.DB.compileHtml(id);
  
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