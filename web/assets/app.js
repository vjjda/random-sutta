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
    // Thử render
    if (window.renderSutta(suttaId, false)) {
      if (shouldUpdateUrl) {
        window.Router.updateURL(suttaId, window.generateBookParam());
      }
    } else {
      // Fallback: Gọi Loader tải thêm file nếu thiếu
      const requiredBook = suttaId.match(/^[a-z]+/)[0];
      window.SuttaLoader.loadBook(requiredBook).then(() => {
        if (window.renderSutta(suttaId, false)) {
          if (shouldUpdateUrl) {
            window.Router.updateURL(suttaId, window.generateBookParam());
          }
        } else {
          alert("Sutta not found.");
        }
      });
    }
  };

  // 2. Load Random Sutta
  function loadRandomSutta(shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;

    const allKeys = Object.keys(window.SUTTA_DB);
    if (allKeys.length === 0) return;

    const activePrefixes = window.getActiveFilters();
    const filteredKeys = allKeys.filter((key) => {
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
        return /^\d$/.test(key.charAt(prefix.length));
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
      window.renderSutta(params.q, true);
    } else {
      if (params.r) {
        loadRandomSutta(false);
      } else {
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
      window.renderSutta(event.state.suttaId);
    } else {
      const q = window.Router.getParams().q;
      if(q) window.loadSutta(q);
    }
  });
});