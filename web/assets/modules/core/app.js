// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { initFilters, generateBookParam } from '../ui/filters.js';
import { setupQuickNav } from '../ui/search_component.js';
import { SuttaController } from './sutta_controller.js';
import { setupLogging, LogLevel, getLogger } from '../shared/logger.js';
import { DB } from '../data/db_manager.js'; // [NEW] Database Manager

const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Config Init
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const params = new URLSearchParams(window.location.search);
  const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
  
  setupLogging({
      level: isDebug ? LogLevel.DEBUG : LogLevel.INFO
  });
  logger.info('DOMContentLoaded', `Logging level set to ${isDebug ? 'DEBUG' : 'INFO'}.`);
  
  // 2. DOM Elements
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");

  // UI Event Bindings
  if (toggleDrawerBtn && filterDrawer) {
      toggleDrawerBtn.addEventListener("click", () => {
          filterDrawer.classList.toggle("hidden");
          toggleDrawerBtn.classList.toggle("open");
      });
  }

  // Window expose (cho các nút onclick trong HTML)
  window.loadSutta = (id, updateUrl, scrollY, options) => 
      SuttaController.loadSutta(id, updateUrl, scrollY, options);
  window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

  // 3. Setup QuickNav
  setupQuickNav((query) => {
      logger.info('QuickNav.onSearch', `Search triggered: ${query}`);
      SuttaController.loadSutta(query);
  });

  // 4. App Bootstrap (Async DB Init)
  statusDiv.textContent = "Loading database index...";
  
  try {
    logger.debug('DOMContentLoaded', "Initializing Database...");
    
    // [NEW] Khởi tạo DB (Tải uid_index.json)
    await DB.init();
    
    logger.info('DOMContentLoaded', "✅ Database initialized. App ready.");
    
    // Update UI State
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    
    // Init Filters
    initFilters();

    // 5. Initial Routing Logic
    const initialParams = Router.getParams();
    
    if (initialParams.q) {
      logger.info('InitialRouting', `Routing to target: ${initialParams.q}`);
      
      // Xử lý Hash nếu có (để scroll chính xác)
      let loadId = initialParams.q;
      if (window.location.hash) {
          loadId += window.location.hash;
      }
      
      SuttaController.loadSutta(loadId, true);
    } else {
      logger.info('InitialRouting', "No target sutta. Triggering Random.");
      
      // Tự động random bài kinh và update URL
      SuttaController.loadRandomSutta(true);
      
      // Nếu chưa có param b (book filter), có thể tự thêm default vào URL nếu muốn
      if (!initialParams.b) {
           // Router.updateURL(null, generateBookParam(), false);
      }
    }

  } catch (err) {
    logger.error('DOMContentLoaded', "Critical Init Error", err);
    statusDiv.textContent = "Error loading database index. Please check connection.";
    statusDiv.style.color = "red";
  }

  // 6. Global Event Listeners
  randomBtn.addEventListener("click", () => {
      SuttaController.loadRandomSutta(true);
  });

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      logger.debug('popstate', `History: ${event.state.suttaId} (Scroll: ${event.state.scrollY})`);
      const savedScroll = event.state.scrollY || 0;
      SuttaController.loadSutta(event.state.suttaId, false, savedScroll, { transition: false });
    } else {
      // Fallback nếu state null (ví dụ user sửa URL tay rồi back)
      const q = Router.getParams().q;
      if(q) SuttaController.loadSutta(q, false, 0);
    }
  });
});