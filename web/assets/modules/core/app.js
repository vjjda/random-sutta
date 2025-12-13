// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { SuttaController } from './sutta_controller.js';
import { SuttaService, RandomBuffer } from '../services/index.js';
import { setupLogging, LogLevel, getLogger } from '../utils/logger.js';
import { FilterComponent } from '../ui/components/filters/index.js';
import { setupQuickNav } from '../ui/components/search.js';
import { initPopupSystem } from '../ui/components/popup/index.js';
import { 
    DrawerManager, 
    OfflineManager, 
    ThemeManager, 
    FontSizeManager 
} from '../ui/managers/index.js';
import { TTSComponent } from '../tts/index.js'; 

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
    ThemeManager.init();
    FontSizeManager.init();
    
    FilterComponent.init(); 
    initPopupSystem(); 
    
    // [UPDATED] Pass onAutoNext callback
    TTSComponent.init({
        onAutoNext: async () => {
            logger.info("TTS", "Triggering auto-random...");
            await SuttaController.loadRandomSutta(true);
        }
    });

    setupQuickNav((query) => SuttaController.loadSutta(query));

    window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
    window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

    const randomBtn = document.getElementById("btn-random");
    const statusDiv = document.getElementById("status");
    const navHeader = document.getElementById("nav-header");
    
    const hideSplashScreen = () => {
        const splashScreen = document.getElementById("splash-screen");
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => {
                splashScreen.remove();
            }, 500);
        }
    };

    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

    try {
        console.time('📡 Service Init');
        await SuttaService.init(); 
        console.timeEnd('📡 Service Init');

        if (navHeader) navHeader.classList.remove("hidden");
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