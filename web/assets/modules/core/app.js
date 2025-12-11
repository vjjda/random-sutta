// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { SuttaController } from './sutta_controller.js';
import { SuttaService } from '../services/sutta_service.js';
import { RandomBuffer } from '../services/random_buffer.js';
import { setupLogging, LogLevel, getLogger } from '../utils/logger.js';
import { initFilters } from '../ui/components/filters.js';
import { setupQuickNav } from '../ui/components/search.js';
import { OfflineManager } from '../ui/managers/offline_manager.js';
import { DrawerManager } from '../ui/managers/drawer_manager.js';

const APP_VERSION = "dev-placeholder";
const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
    console.time('🚀 App Start to Ready');
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
    const statusDiv = document.getElementById("status"); // Text bên trong Splash
    const navHeader = document.getElementById("nav-header");
    const splashScreen = document.getElementById("splash-screen"); // [NEW] Container lớn

    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

    try {
        console.time('📡 Service Init');
        await SuttaService.init(); 
        console.timeEnd('📡 Service Init');

        // [UPDATED] Ẩn Splash Screen chuyên nghiệp
        if (splashScreen) {
            // 1. Fade out bằng CSS transition
            splashScreen.style.opacity = '0';
            // 2. Xóa khỏi DOM sau khi animation xong (0.5s khớp với CSS)
            setTimeout(() => {
                splashScreen.remove();
            }, 500);
        }

        navHeader.classList.remove("hidden");
        randomBtn.disabled = false;

        const initialParams = Router.getParams();

        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            
            console.time('⏱️ Direct Load Total');
            await SuttaController.loadSutta(loadId, true);
            console.timeEnd('⏱️ Direct Load Total');
            RandomBuffer.startBackgroundWork();
        } else {
            RandomBuffer.startBackgroundWork();
            SuttaController.loadRandomSutta(true);
        }
        console.timeEnd('🚀 App Start to Ready');

    } catch (err) {
        logger.error('Init', err);
        // [UPDATED] Nếu lỗi, hiện thông báo ngay trên Splash Screen
        if (statusDiv) {
            statusDiv.textContent = "Error loading database.";
            statusDiv.style.color = "#ff6b6b"; // Màu đỏ nhạt cho nền tối
        }
    }

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