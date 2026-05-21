// Path: web/assets/modules/core/app.js
import { AppRouter } from "core/app_router.js";
import { AppSettings } from "core/app_settings.js";
import { SuttaController } from "core/sutta_controller.js";
import { SuttaDB } from "data/sutta_db.js";
import { SuttaService } from "services/index.js";
import { setupLogging, LogLevel, getLogger } from "utils/logger.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { setupQuickNav } from "ui/components/nav_search/nav_search.js";
import { initPopupSystem } from "ui/components/popup/index.js";
import {
  DrawerManager,
  OfflineManager,
  ThemeManager,
  FontSizeManager,
  GestureManager,
  BookmarkManager,
  ReadManager,
  SyncUIManager,
  TooltipManager,
  DisplaySettingsManager,
} from "ui/managers/index.js";
import { ViewManager } from "ui/managers/view_manager.js";
import { ScrollManager } from "ui/managers/scroll_manager.js";
import { RandomButton } from "ui/components/random_button.js";
import { TTSBootstrap } from "tts/tts_bootstrap.js";
import { initLookup } from "lookup/index.js";
import { ToolbarManager } from "toolbar/toolbar_manager.js";

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev-mode";
const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
  console.time("🚀 App Start to Ready");

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const params = new URLSearchParams(window.location.search);
  const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
  setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

  // Expose globals for debugging or external calls
  window.SuttaDB = SuttaDB; 
  window.SuttaController = SuttaController; 
  window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
  window.triggerRandomSutta = (options = {}) => SuttaController.loadRandomSutta(true, options);

  // --- Phase 1: Critical UI Managers (Immediate) ---
  AppSettings.init();
  ThemeManager.init();
  FontSizeManager.init();
  DisplaySettingsManager.init();
  ScrollManager.init();

  // --- Phase 2: Structural UI (Required for interaction) ---
  DrawerManager.init();
  GestureManager.init();
  initPopupSystem();
  FilterComponent.init();

  // --- Phase 3: Secondary Components (Deferred to Idle) ---
  const initSecondary = () => {
    BookmarkManager.init();
    ReadManager.init();
    SyncUIManager.init();
    TooltipManager.init();
    ToolbarManager.init();
    RandomButton.init();

    TTSBootstrap.init({
      onAutoNext: async () => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("q")) {
            logger.info("TTS", "Triggering auto-random...");
            await SuttaController.loadRandomSutta(true);
        }
      },
    });

    setupQuickNav((query) => SuttaController.loadSutta(query));
  };

  if (window.requestIdleCallback) {
    window.requestIdleCallback(initSecondary);
  } else {
    setTimeout(initSecondary, 200);
  }

  // --- Phase 4: Service Initialization (Hybrid Loading) ---
  try {
    console.time("📡 Service Init");
    await SuttaService.init();
    console.timeEnd("📡 Service Init");
  } catch (err) {
    logger.error("Init", "Service initialization failed:", err);
  } finally {
    const navHeader = document.getElementById("nav-header");
    if (navHeader) navHeader.classList.remove("hidden");
    
    // Enable critical interaction buttons
    const btnsToEnable = ["btn-random", "btn-landing-random"];
    btnsToEnable.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
          btn.disabled = false;
          logger.debug("Init", `Enabled interaction button: ${id}`);
      }
    });

    // Delegate Routing to AppRouter
    await AppRouter.init().catch(e => logger.error("Router", e));

    ViewManager.hideSplashScreen();
    console.timeEnd("🚀 App Start to Ready");

    // [OPTIMIZED] Start heavy background tasks
    const startBackgroundTasks = () => {
        logger.info("Init", "Starting delayed background tasks (Lookup/Offline)...");
        initLookup();
        OfflineManager.init();
    };

    if (window.requestIdleCallback) {
        window.requestIdleCallback(startBackgroundTasks, { timeout: 3000 });
    } else {
        setTimeout(startBackgroundTasks, 2000);
    }
  }
});
