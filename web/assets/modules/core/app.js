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
import { ThemeManager } from '../ui/managers/theme_manager.js'; // [NEW]

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
    ThemeManager.init(); // [NEW] Khởi tạo Theme
    initFilters();
    setupQuickNav((query) => SuttaController.loadSutta(query));

    window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
    window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

    const randomBtn = document.getElementById("btn-random");
    const statusDiv = document.getElementById("status"); 
    const navHeader = document.getElementById("nav-header");
    
    // [MOVED] Hàm ẩn splash được tách ra để gọi sau
    const hideSplashScreen = () => {
        const splashScreen = document.getElementById("splash-screen");
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => {
                splashScreen.remove();
            }, 500); // Khớp với transition trong CSS
        }
    };

    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

    try {
        console.time('📡 Service Init');
        await SuttaService.init(); 
        console.timeEnd('📡 Service Init');

        // [REMOVED] KHÔNG ẩn splash ở đây nữa.
        // Giữ splash đè lên cho đến khi load content xong.

        navHeader.classList.remove("hidden");
        randomBtn.disabled = false;

        const initialParams = Router.getParams();

        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            
            console.time('⏱️ Direct Load Total');
            // Chờ load xong mới đi tiếp
            await SuttaController.loadSutta(loadId, true);
            console.timeEnd('⏱️ Direct Load Total');
            
            RandomBuffer.startBackgroundWork();
        } else {
            RandomBuffer.startBackgroundWork();
            // [UPDATED] Thêm await để chờ random load xong mới ẩn splash
            await SuttaController.loadRandomSutta(true);
        }
        
        // [NEW] Giờ mới ẩn Splash -> Chuyển cảnh mượt mà từ Logo sang Nội dung
        hideSplashScreen();
        console.timeEnd('🚀 App Start to Ready');

    } catch (err) {
        logger.error('Init', err);
        if (statusDiv) {
            statusDiv.textContent = "Error loading database.";
            statusDiv.style.color = "#ff6b6b"; 
        }
        // Nếu lỗi thì vẫn phải ẩn splash để user thấy báo lỗi (hoặc xử lý hiển thị lỗi trên splash)
        // Ở đây ta cứ ẩn đi để hiện giao diện fallback nếu có
        hideSplashScreen();
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