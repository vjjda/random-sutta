// Path: web/assets/modules/renderer.js

// Hàm helper nội bộ
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

// --- TÍNH NĂNG MỚI: Quick Nav Logic ---
window.setupQuickNav = function () {
  const displayContainer = document.getElementById("nav-title-display");
  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  const inputField = document.getElementById("nav-sutta-input");
  const goBtn = document.getElementById("nav-search-btn");

  if (!displayContainer || !textMode || !inputMode) return;

  // 1. Chuyển sang Input Mode khi click
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

    if (window.SUTTA_DB && window.SUTTA_DB[query]) {
      window.loadSutta(query); 
      // loadSutta sẽ gọi updateTopNavLocal -> Tự động reset về Text Mode
    } else {
      alert(`Sutta ID "${query}" not found!`);
      inputField.select(); // Bôi đen để nhập lại
    }
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

// Hàm render chính (đã có từ trước, giữ nguyên logic gọi updateTopNavLocal)
window.renderSutta = function (suttaId, checkHash = true) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");

  const id = suttaId.toLowerCase().trim();
  if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
    container.innerHTML = `<p class="placeholder" style="color:red">Sutta ID "<b>${id}</b>" not found.</p>`;
    statusDiv.textContent = "Error: Sutta not found.";
    statusDiv.classList.remove("hidden");
    navHeader.classList.add("hidden");
    return false;
  }

  const data = window.SUTTA_DB[id];
  
  // Gọi hàm cập nhật Nav (đã sửa ở trên)
  updateTopNavLocal(id, data.previous, data.next);

  // ... (Phần còn lại của logic render giữ nguyên như cũ) ...
  let bottomNavHtml = '<div class="sutta-nav">';
  if (data.previous) {
    const prevInfo = window.getSuttaDisplayInfo(data.previous);
    bottomNavHtml += `<button onclick="window.loadSutta('${data.previous}')" class="nav-btn">← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span></button>`;
  } else {
    bottomNavHtml += `<span></span>`;
  }
  if (data.next) {
    const nextInfo = window.getSuttaDisplayInfo(data.next);
    bottomNavHtml += `<button onclick="window.loadSutta('${data.next}')" class="nav-btn">${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span></button>`;
  }
  bottomNavHtml += "</div>";

  container.innerHTML = data.content + bottomNavHtml;

  const hash = window.location.hash;
  if (checkHash && hash) {
    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      targetElement.classList.add("highlight");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return true;
};