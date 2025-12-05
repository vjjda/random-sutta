// Path: web/assets/app.js
import { SuttaLoader } from './modules/loader.js';
import { Router } from './modules/router.js';
import { initFilters, generateBookParam } from './modules/filters.js';
import { setupQuickNav } from './modules/search_component.js';
import { SuttaController } from './modules/sutta_controller.js';
import { setupLogging, LogLevel, getLogger } from './modules/logger.js';

const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Config Init
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  // Force về đầu trang ngay lập tức
  window.scrollTo(0, 0);

  const params = new URLSearchParams(window.location.search);
  const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
  
  setupLogging({
      level: isDebug ? LogLevel.DEBUG : LogLevel.INFO
  });
  
  // 2. DOM Elements & UI Setup
  // ... (Giữ nguyên phần này) ...
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");

  if (toggleDrawerBtn && filterDrawer) {
      toggleDrawerBtn.addEventListener("click", () => {
          filterDrawer.classList.toggle("hidden");
          toggleDrawerBtn.classList.toggle("open");
      });
  }

  // Window expose
  window.loadSutta = (id, updateUrl, scrollY, options) => 
      SuttaController.loadSutta(id, updateUrl, scrollY, options);
  window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

  // 3. Setup QuickNav
  setupQuickNav((query) => {
      logger.info(`🔍 Search triggered via QuickNav: ${query}`);
      SuttaController.loadSutta(query);
  });

  // 4. App Bootstrap
  statusDiv.textContent = "Loading core library...";
  try {
    logger.debug("Starting SuttaLoader initialization...");
    await SuttaLoader.initSmartLoading();
    
    // App Ready State
    logger.info("✅ Core library loaded. App ready.");
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    
    initFilters();

    // 6. Initial Routing
    const initialParams = Router.getParams();
    if (initialParams.q) {
      logger.info(`Routing to initial sutta: ${initialParams.q}`);
      
      // [FIX] Ghép thêm Hash từ URL (nếu có) để Controller biết cần scroll đến đâu
      // Ví dụ: q=an1.1-10 và hash=#an1.3 -> loadId = an1.1-10#an1.3
      let loadId = initialParams.q;
      if (window.location.hash) {
          loadId += window.location.hash;
      }
      
      SuttaController.loadSutta(loadId, true);
    } else {
      logger.info("No initial sutta, loading random/default logic.");
      SuttaController.loadRandomSutta(false);
      if (!initialParams.q && !initialParams.r) {
           Router.updateURL(null, generateBookParam(), true);
      }
    }

  } catch (err) {
    logger.error("Critical Init Error", err);
    statusDiv.textContent = "Error loading library.";
  }

  // 7. Event Listeners
  randomBtn.addEventListener("click", () => {
      logger.debug("Random button clicked");
      SuttaController.loadRandomSutta(true);
  });

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      logger.debug(`Popstate event: ${event.state.suttaId} (Scroll: ${event.state.scrollY})`);
      const savedScroll = event.state.scrollY || 0;
      SuttaController.loadSutta(event.state.suttaId, false, savedScroll);
    } else {
      const q = Router.getParams().q;
      if(q) SuttaController.loadSutta(q, false, 0);
    }
  });
});