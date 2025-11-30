// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");

  const { hideComment } = window.initCommentPopup();

  window.loadSutta = function (suttaId, shouldUpdateUrl = true) {
    hideComment();
    if (window.renderSutta(suttaId, false)) {
      if (shouldUpdateUrl) {
        const bookParam = window.generateBookParam();
        window.updateURL(suttaId, bookParam);
      }
    }
  };

  function loadRandomSutta(shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;

    const allKeys = Object.keys(window.SUTTA_DB);
    if (allKeys.length === 0) return;

    const activePrefixes = window.getActiveFilters();

    const filteredKeys = allKeys.filter((key) => {
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
        const nextChar = key.charAt(prefix.length);
        return /^\d$/.test(nextChar);
      });
    });

    if (filteredKeys.length === 0) {
      alert("No suttas match your selected filters!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredKeys.length);
    const suttaId = filteredKeys[randomIndex];

    window.loadSutta(suttaId, shouldUpdateUrl);
  }

  // --- FIX LOADING LOGIC ---
  function waitForData() {
    // Kiểm tra xem DB đã có key nào chưa
    const isDbReady =
      window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0;

    // UPDATED: Kiểm tra xem Names đã có key nào chưa
    const isNamesReady =
      window.SUTTA_NAMES && Object.keys(window.SUTTA_NAMES).length > 0;

    // Chỉ chạy tiếp khi CẢ HAI đều sẵn sàng
    if (isDbReady && isNamesReady) {
      const count = Object.keys(window.SUTTA_DB).length;
      const nameCount = Object.keys(window.SUTTA_NAMES).length;

      statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
      statusDiv.classList.remove("hidden");
      navHeader.classList.add("hidden");
      randomBtn.disabled = false;

      window.initFilters();

      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      const isRandomLoop = params.get("r");

      if (isRandomLoop) {
        loadRandomSutta(false);
      } else if (queryId) {
        window.renderSutta(queryId, true);
      } else {
        loadRandomSutta(false);
        const bookParam = window.generateBookParam();
        window.updateURL(null, bookParam, true);
      }
    } else {
      // Nếu chưa đủ dữ liệu, tiếp tục chờ
      statusDiv.textContent = "Loading database files...";

      // Debug log để bạn thấy nó đang chờ cái gì (F12 Console)
      // console.log(`Waiting... DB: ${isDbReady}, Names: ${isNamesReady}`);

      setTimeout(waitForData, 100);
    }
  }

  randomBtn.addEventListener("click", () => loadRandomSutta(true));

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      window.renderSutta(event.state.suttaId);
    } else {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      if (queryId) window.renderSutta(queryId);
    }
  });

  waitForData();
});
