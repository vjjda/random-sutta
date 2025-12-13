// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { SuttaController } from './sutta_controller.js';
// [REFACTORED] Import từ Service Gateway
import { SuttaService, RandomBuffer } from '../services/index.js';
// Utils
import { setupLogging, LogLevel, getLogger } from '../utils/logger.js';

// UI Components
import { FilterComponent } from '../ui/components/filters/index.js';
import { setupQuickNav } from '../ui/components/search.js';
// [REFACTORED] Import Popup System từ gateway index.js của nó
import { initPopupSystem } from '../ui/components/popup/index.js';
// [REFACTORED] Import Managers từ Gateway (Thay vì 4 dòng import lẻ)
import { 
    DrawerManager, 
    OfflineManager, 
    ThemeManager, 
    FontSizeManager 
} from '../ui/managers/index.js';

// [NEW] TTS System Import
import { TTSComponent } from '../tts/index.js'; 

const APP_VERSION = "dev-placeholder";
const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
    console.time('🚀 App Start to Ready');
    
    // 1. Cấu hình cơ bản
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    
    // Setup Logger
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
    setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

    // 2. Khởi tạo các Manager (UI State)
    DrawerManager.init();
    OfflineManager.init();
    ThemeManager.init();
    FontSizeManager.init();
    
    // 3. Khởi tạo Components
    FilterComponent.init(); 
    initPopupSystem(); 
    
    // [NEW] Initialize TTS
    TTSComponent.init();

    // Setup Search/QuickNav
    setupQuickNav((query) => SuttaController.loadSutta(query));

    // 4. Expose Global API (Dùng cho các nút onclick trong HTML)
    window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
    window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

    // 5. Kết nối DOM Elements chính
    const randomBtn = document.getElementById("btn-random");
    const statusDiv = document.getElementById("status");
    const navHeader = document.getElementById("nav-header");
    
    // Helper ẩn Splash Screen
    const hideSplashScreen = () => {
        const splashScreen = document.getElementById("splash-screen");
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => {
                splashScreen.remove();
            }, 500);
        }
    };

    // Event Listeners
    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

    // 6. Khởi động Service & Load Content
    try {
        console.time('📡 Service Init');
        await SuttaService.init(); // Khởi tạo Repository & Helper
        console.timeEnd('📡 Service Init');

        // UI Ready state
        if (navHeader) navHeader.classList.remove("hidden");
        randomBtn.disabled = false;

        const initialParams = Router.getParams();
        
        // A. Load bài cụ thể nếu có tham số ?q=...
        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            
            console.time('⏱️ Direct Load Total');
            await SuttaController.loadSutta(loadId, true);
            console.timeEnd('⏱️ Direct Load Total');

            // Vẫn chạy buffer ngầm để sẵn sàng cho random
            RandomBuffer.startBackgroundWork();
        } 
        // B. Random mặc định nếu không có tham số
        else {
            RandomBuffer.startBackgroundWork();
            await SuttaController.loadRandomSutta(true);
        }
        
        hideSplashScreen();
        console.timeEnd('🚀 App Start to Ready');

    } catch (err) {
        logger.error('Init', err);
        if (statusDiv) {
            statusDiv.textContent = "Error loading database.";
            statusDiv.style.color = "#ff6b6b"; 
        }
        hideSplashScreen();
    }

    // 7. Xử lý Back/Forward Browser
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