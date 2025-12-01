// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");

  // Drawer logic ... (giữ nguyên)
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");
  if (toggleDrawerBtn && filterDrawer) {
    toggleDrawerBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("hidden");
      toggleDrawerBtn.classList.toggle("open");
    });
  }

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

  // --- DATA LOADING LOGIC (SIMPLIFIED) ---
  let loadAttempts = 0;
  const MAX_ATTEMPTS = 100;

  function waitForData() {
    const dbCount = (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length) || 0;
    
    // REMOVED: const nameCount = ...
    // UPDATED CONDITION: Chỉ cần DB > 0 là đủ
    const isDbReady = dbCount > 0;

    if (isDbReady) {
      // --- SUCCESS ---
      // statusDiv.textContent = `Library loaded: ${dbCount} suttas (${nameCount} meta-entries).`;
      statusDiv.textContent = `Library loaded: ${dbCount} suttas.`;
      statusDiv.classList.remove("hidden");

      setTimeout(() => {
        statusDiv.classList.add("hidden");
      }, 3000);

      navHeader.classList.add("hidden");
      randomBtn.disabled = false;

      window.initFilters();
      if (window.setupQuickNav) window.setupQuickNav();

      // Router Logic
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
      loadAttempts++;
      if (loadAttempts > MAX_ATTEMPTS) {
        console.error("Timeout waiting for data.");
        statusDiv.innerHTML = `
            <span style="color: red;">⚠️ Connection timeout. Loaded ${dbCount} suttas.</span><br>
            <button onclick="location.reload()" style="margin-top: 10px; cursor: pointer; padding: 5px 10px;">↻ Reload Page</button>
        `;
        return;
      }

      if (loadAttempts % 5 === 0) {
        statusDiv.innerHTML = `Loading library... <br>Found: <b>${dbCount}</b> texts...`;
      }
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