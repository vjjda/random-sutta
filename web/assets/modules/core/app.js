// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { SuttaController } from './sutta_controller.js';
import { SuttaService } from '../services/sutta_service.js'; // [CHANGED] Import Service thay vì Repo
import { setupLogging, LogLevel, getLogger } from '../utils/logger.js';
import { initFilters } from '../ui/components/filters.js';
import { setupQuickNav } from '../ui/components/search.js';
import { OfflineManager } from '../ui/managers/offline_manager.js';
import { DrawerManager } from '../ui/managers/drawer_manager.js';

// [FIX] Thêm biến này để Release System inject version vào
const APP_VERSION = "dev-placeholder";

const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
    console.time('🚀 App Start to Ready');
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
        // [FIXED] Init Service (Service sẽ init Repo và Helper)
        console.time('📡 Service Init');
        await SuttaService.init(); 
        console.timeEnd('📡 Service Init');

        statusDiv.classList.add("hidden");
        navHeader.classList.remove("hidden");
        randomBtn.disabled = false;

        const initialParams = Router.getParams();
        
        // [OPTIMIZATION] Direct Load Strategy
        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            
            // 1. Load the requested sutta IMMEDIATELY (High Priority)
            // We await this to ensure full bandwidth is dedicated to the user's request
            console.time('⏱️ Direct Load Total');
            await SuttaController.loadSutta(loadId, true);
            console.timeEnd('⏱️ Direct Load Total');
            
            // 2. ONLY start background work (buffering/preloading) after the main content is ready
            SuttaService.startBackgroundWork();
        } else {
            // Home Page Strategy:
            // 1. Start buffering immediately so the Random button becomes instant ASAP
            SuttaService.startBackgroundWork();
            
            // 2. Load the first random sutta
            SuttaController.loadRandomSutta(true);
        }
        console.timeEnd('🚀 App Start to Ready');
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