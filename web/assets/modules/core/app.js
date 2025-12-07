// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { SuttaController } from './sutta_controller.js';
// [UPDATED] Import Repository mới
import { SuttaRepository } from '../data/sutta_repository.js'; 
import { setupLogging, LogLevel, getLogger } from '../utils/logger.js';
import { initFilters } from '../ui/components/filters.js';
import { setupQuickNav } from '../ui/components/search.js';
import { OfflineManager } from '../ui/managers/offline_manager.js';
import { DrawerManager } from '../ui/managers/drawer_manager.js';

const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
    // ... (Giữ nguyên phần setup logging và UI components) ...
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
    setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

    DrawerManager.init();
    OfflineManager.init();
    initFilters();
    setupQuickNav((query) => SuttaController.loadSutta(query));

    window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
    window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

    const randomBtn = document.getElementById("btn-random");
    const statusDiv = document.getElementById("status");
    const navHeader = document.getElementById("nav-header");

    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

    try {
        // [UPDATED] Init Repository
        await SuttaRepository.init();
        
        statusDiv.classList.add("hidden");
        navHeader.classList.remove("hidden");
        randomBtn.disabled = false;

        const initialParams = Router.getParams();
        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            SuttaController.loadSutta(loadId, true);
        } else {
            SuttaController.loadRandomSutta(true);
        }
    } catch (err) {
        logger.error('Init', err);
        statusDiv.textContent = "Error loading database.";
    }

    // ... (Giữ nguyên phần popstate) ...
    window.addEventListener("popstate", (event) => {
        const currentParams = Router.getParams();
        const savedScroll = (event.state && event.state.scrollY) ? event.state.scrollY : 0;
        
        if (currentParams.q) {
            let loadId = currentParams.q;
            if (window.location.hash) loadId += window.location.hash;
            SuttaController.loadSutta(loadId, false, savedScroll, { transition: false });
        } else {
            SuttaController.loadRandomSutta(false); 
        }
    });
});