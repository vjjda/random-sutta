// Path: web/assets/app.js
import { SuttaLoader } from './modules/loader.js';
import { Router } from './modules/router.js';
import { initFilters, generateBookParam } from './modules/filters.js';
import { setupQuickNav } from './modules/search_component.js';
import { SuttaController } from './modules/sutta_controller.js'; // [NEW]

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Config Init
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  
  // 2. DOM Elements
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");

  // 3. UI Event Binding
  if (toggleDrawerBtn && filterDrawer) {
    toggleDrawerBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("hidden");
      toggleDrawerBtn.classList.toggle("open");
    });
  }

  // --- EXPOSE GLOBAL API ---
  // [UPDATED] Cho phép truyền thêm params (scrollY và options)
  window.loadSutta = (id, updateUrl, scrollY, options) => 
      SuttaController.loadSutta(id, updateUrl, scrollY, options);

  window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

  // 4. Feature Modules Init
  setupQuickNav((query) => {
      SuttaController.loadSutta(query);
  });

  // 5. App Bootstrap
  statusDiv.textContent = "Loading core library...";
  try {
    await SuttaLoader.initSmartLoading();

    // App Ready State
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    
    initFilters();

    // 6. Initial Routing
    const params = Router.getParams();
    if (params.q) {
      SuttaController.loadSutta(params.q, true);
    } else {
      // Default to Random or Landing logic
      SuttaController.loadRandomSutta(false);
      if (!params.q && !params.r) {
           Router.updateURL(null, generateBookParam(), true);
      }
    }

  } catch (err) {
    console.error("Init Error:", err);
    statusDiv.textContent = "Error loading library.";
  }

  // 7. Event Listeners
  randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      // [UPDATED] Truyền thêm tham số thứ 3: event.state.scrollY
      const savedScroll = event.state.scrollY || 0;
      SuttaController.loadSutta(event.state.suttaId, false, savedScroll);
    } else {
      const q = Router.getParams().q;
      // Mặc định về 0 nếu không có state
      if(q) SuttaController.loadSutta(q, false, 0);
    }
  });
});