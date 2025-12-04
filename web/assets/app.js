// Path: web/assets/app.js
import { SuttaLoader } from './modules/loader.js';
import { Router } from './modules/router.js';
import { initFilters, getActiveFilters, generateBookParam } from './modules/filters.js';
import { initCommentPopup } from './modules/utils.js';
import { DB } from './modules/db_manager.js';
import { renderSutta } from './modules/renderer.js';
import { setupQuickNav } from './modules/search_component.js';

document.addEventListener("DOMContentLoaded", async () => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");
  
  // UI Init
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");
  if (toggleDrawerBtn && filterDrawer) {
    toggleDrawerBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("hidden");
      toggleDrawerBtn.classList.toggle("open");
    });
  }

  const { hideComment } = initCommentPopup();

  // --- CORE FUNCTIONS ---

  window.loadSutta = function (suttaIdInput, shouldUpdateUrl = true) {
    hideComment();
    
    // 1. Phân tích Input: "mn5#1.2" -> id="mn5", hash="1.2"
    let [baseId, hashPart] = suttaIdInput.split('#');
    const suttaId = baseId.trim().toLowerCase();
    const explicitHash = hashPart ? hashPart : null;

    // 2. Quyết định xem có nên dùng Hash cũ của trình duyệt không?
    // Lấy ID hiện tại trên URL
    const params = new URLSearchParams(window.location.search);
    const currentUrlId = params.get("q");

    // Logic: 
    // - Nếu có explicitHash (người dùng gõ mn5#1.2) -> Dùng nó.
    // - Nếu KHÔNG có explicitHash:
    //    + Nếu đang Reload (suttaId == currentUrlId) -> Dùng hash cũ của trình duyệt (checkHash=true).
    //    + Nếu đang Chuyển bài (suttaId != currentUrlId) -> BỎ hash cũ (checkHash=false).
    
    let renderOptions = {};
    if (explicitHash) {
        renderOptions = { highlightId: explicitHash };
    } else {
        // Nếu bài mới != bài cũ, ta CẤM renderer nhìn vào window.location.hash
        const isSamePage = currentUrlId === suttaId;
        renderOptions = { checkHash: isSamePage }; 
    }

    // 3. Gọi Renderer
    if (renderSutta(suttaId, renderOptions)) {
      if (shouldUpdateUrl) {
        // Truyền explicitHash cho Router để nó cập nhật URL đúng
        Router.updateURL(suttaId, generateBookParam(), false, explicitHash ? `#${explicitHash}` : null);
      }
    } else {
      // ... (Phần logic Lazy Load giữ nguyên, nhưng cập nhật gọi renderSutta với renderOptions) ...
      const bookFile = SuttaLoader.findBookFileFromSuttaId(suttaId);
      if(bookFile) {
          const bookId = bookFile.split('/').pop().replace('_book.js', '').replace('.js', '');
          SuttaLoader.loadBook(bookId).then(() => {
            if (renderSutta(suttaId, renderOptions)) {
              if (shouldUpdateUrl) {
                Router.updateURL(suttaId, generateBookParam(), false, explicitHash ? `#${explicitHash}` : null);
              }
            } else {
              if (searchControl) searchControl.activateSearchMode();
            }
          });
      } else {
          renderSutta(suttaId, renderOptions);
          if (searchControl) searchControl.activateSearchMode();
      }
    }
  };

  function loadRandomSutta(shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;

    const allSuttas = DB.getAllAvailableSuttas();
    if (allSuttas.length === 0) return;

    const activePrefixes = getActiveFilters();
    const filteredKeys = allSuttas.filter((key) => {
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
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
  
  window.triggerRandomSutta = () => loadRandomSutta(true);

  // --- INIT FEATURE MODULES ---
  
  const searchControl = setupQuickNav((query) => {
      window.loadSutta(query);
  });

  statusDiv.textContent = "Loading core library...";
  try {
    // 1. Load Data
    await SuttaLoader.initSmartLoading();

    // 2. App Ready
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    
    initFilters();

    // 3. Routing Init
    const params = Router.getParams();
    if (params.q) {
      window.loadSutta(params.q, true);
    } else {
      if (params.r) {
        loadRandomSutta(false);
      } else {
        loadRandomSutta(false);
        Router.updateURL(null, generateBookParam(), true);
      }
    }

  } catch (err) {
    console.error("Init Error:", err);
    statusDiv.textContent = "Error loading library.";
  }

  // Events
  randomBtn.addEventListener("click", () => loadRandomSutta(true));

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      window.loadSutta(event.state.suttaId, false);
    } else {
      const q = Router.getParams().q;
      if(q) window.loadSutta(q, false);
    }
  });
});