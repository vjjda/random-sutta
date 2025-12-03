// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", async () => {
  // --- UI Elements ---
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");

  // --- UI Init ---
  if (toggleDrawerBtn && filterDrawer) {
    toggleDrawerBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("hidden");
      toggleDrawerBtn.classList.toggle("open");
    });
  }
  const { hideComment } = window.initCommentPopup();

  // --- Business Logic Functions ---

  // 1. Load Single Sutta
  window.loadSutta = function (suttaId, shouldUpdateUrl = true) {
    hideComment();
    
    // Thử render nếu dữ liệu đã có
    if (window.renderSutta(suttaId, false)) {
      if (shouldUpdateUrl) {
        window.Router.updateURL(suttaId, window.generateBookParam());
      }
    } else {
      // Fallback: Gọi Loader tải thêm file nếu thiếu
      // ID sutta thường bắt đầu bằng mã sách, vd mn20 -> mn. 
      // Nhưng một số id phức tạp hơn, regex này lấy phần chữ cái đầu.
      const match = suttaId.match(/^[a-z]+/);
      if(match) {
          const requiredBook = match[0];
          window.SuttaLoader.loadBook(requiredBook).then(() => {
            if (window.renderSutta(suttaId, false)) {
              if (shouldUpdateUrl) {
                window.Router.updateURL(suttaId, window.generateBookParam());
              }
            } else {
              alert("Sutta not found.");
            }
          });
      } else {
          alert("Invalid Sutta ID format.");
      }
    }
  };

  // 2. Load Random Sutta (LOGIC MỚI)
  function loadRandomSutta(shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;

    // Lấy tất cả ID bài kinh đang có
    const allSuttas = window.DB.getAllAvailableSuttas();
    if (allSuttas.length === 0) return;

    const activePrefixes = window.getActiveFilters(); // ["mn", "dn", ...]

    // Lọc danh sách dựa trên Filter
    const filteredKeys = allSuttas.filter((key) => {
      // key là "mn20", prefix là "mn". 
      // Logic kiểm tra: key phải bắt đầu bằng prefix 
      // VÀ ký tự tiếp theo phải là số (để tránh nhầm mn vs mnd)
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
        // Kiểm tra ký tự ngay sau prefix có phải là số không
        const nextChar = key.charAt(prefix.length);
        return /\d/.test(nextChar); 
      });
    });

    if (filteredKeys.length === 0) {
      alert("No suttas match your selected filters!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredKeys.length);
    window.loadSutta(filteredKeys[randomIndex], shouldUpdateUrl);
  }

  // --- Main Execution Flow ---
  
  statusDiv.textContent = "Loading core library...";
  try {
    // A. Chạy Smart Loader
    await window.SuttaLoader.initSmartLoading();

    // B. App Ready
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    
    window.initFilters();
    if (window.setupQuickNav) window.setupQuickNav();

    // C. Handle Initial Route
    const params = window.Router.getParams();
    if (params.q) {
      window.loadSutta(params.q, true); // Dùng loadSutta thay vì renderSutta để handle lazy load
    } else {
      if (params.r) {
        loadRandomSutta(false);
      } else {
        // Mặc định load random nếu không có params, nhưng update URL sạch
        loadRandomSutta(false);
        window.Router.updateURL(null, window.generateBookParam(), true);
      }
    }

  } catch (err) {
    console.error("Init Error:", err);
    statusDiv.textContent = "Error loading library.";
  }

  // --- Event Listeners ---
  randomBtn.addEventListener("click", () => loadRandomSutta(true));

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      window.loadSutta(event.state.suttaId, false); // Không update URL đè lại
    } else {
      const q = window.Router.getParams().q;
      if(q) window.loadSutta(q, false);
    }
  });
});