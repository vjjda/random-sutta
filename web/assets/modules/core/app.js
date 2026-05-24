// Path: web/assets/modules/core/app.js
import { AppRouter } from "core/app_router.js";
import { AppSettings } from "core/app_settings.js";
import { SuttaController } from "core/sutta_controller.js";
import { SuttaDB } from "data/sutta_db.js";
import { SuttaService } from "services/index.js";
import { setupLogging, LogLevel, getLogger } from "utils/logger.js";
import { UIUtils } from "utils/ui_utils.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { setupQuickNav } from "ui/components/nav_search/nav_search.js";
import { initPopupSystem } from "ui/components/popup/index.js";
import {
  DrawerManager,
  OfflineManager,
  ThemeManager,
  FontSizeManager,
  MarginManager,
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
import { PWAManager } from "services/pwa/pwa_manager.js";
import { NativeUpdater } from "services/pwa/native_updater.js";

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev-mode";
const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
  console.time("🚀 App Start to Ready");

  // --- Global Timeout Safety ---
  let isReadyHandled = false;
  const initTimeout = setTimeout(() => {
    if (!isReadyHandled) {
      logger.warn("Init", "Initialization is taking too long (15s). Something might be hung.");
      handleInitError(new Error("Loading is taking longer than usual. You may have a slow connection or be offline."));
      
      // Allow user to try to enter anyway
      const statusDiv = document.getElementById("status");
      if (statusDiv) {
        const entryBtn = document.createElement("button");
        entryBtn.innerText = "Try Starting Anyway";
        entryBtn.className = "pwa-btn-ghost";
        entryBtn.style.marginTop = "10px";
        entryBtn.onclick = () => {
          ViewManager.hideSplashScreen();
          isReadyHandled = true;
          
          // [FIX] Enable buttons if forced entry
          const randomBtn = document.getElementById("btn-random");
          if (randomBtn) randomBtn.disabled = false;
          const landingRandomBtn = document.getElementById("btn-landing-random");
          if (landingRandomBtn) landingRandomBtn.disabled = false;
        };
        statusDiv.appendChild(document.createElement("br"));
        statusDiv.appendChild(entryBtn);
      }
    }
  }, 15000);

  // Initialize Update Managers
  PWAManager.init();
  NativeUpdater.init();

  // Lock safe area bottom to prevent shifting during scroll
  UIUtils.lockSafeAreaBottom();
  UIUtils.initViewportLock();

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
  MarginManager.init();
  DisplaySettingsManager.init();
  ScrollManager.init();

  // --- Phase 2: Structural UI (Required for interaction) ---
  DrawerManager.init();
  GestureManager.init();
  initPopupSystem();
  FilterComponent.init();
  // [MOVED] RandomButton needs to be ready as soon as the landing view is visible
  RandomButton.init();

  // --- Phase 3: Secondary Components (Deferred to Idle) ---
  const initSecondary = () => {
    BookmarkManager.init();
    ReadManager.init();
    SyncUIManager.init();
    TooltipManager.init();
    ToolbarManager.init();

    TTSBootstrap.init({
      onAutoNext: async () => {
        logger.info("TTS", "Triggering auto-random...");
        await SuttaController.loadRandomSutta(true);
      },
    });
    setupQuickNav((query) => SuttaController.loadSutta(query));
  };

  if (window.requestIdleCallback) {
    window.requestIdleCallback(initSecondary);
  } else {
    setTimeout(initSecondary, 200);
  }

  const handleInitError = (err) => {
    if (isReadyHandled) return;
    logger.error("Init", err);
    const statusDiv = document.getElementById("status");
    const splashLoader = document.querySelector(".splash-loader-box");
    
    if (statusDiv) {
      const isOffline = !navigator.onLine;
      const errorMsg = isOffline 
        ? "App is offline and data is not cached yet. Please connect to internet for the first run."
        : (err.message || "Failed to load database.");

      statusDiv.innerHTML = `
        <div style="color: #ff6b6b; margin-bottom: 20px; padding: 0 20px;">
          <b style="font-size: 1.1rem;">Initialization Issue</b><br/>
          <span style="font-size: 0.85rem; opacity: 0.8;">${errorMsg}</span>
        </div>
        <button id="btn-retry-init" style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 24px;
          cursor: pointer;
          font-weight: bold;
          font-size: 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        ">Retry Loading</button>
      `;
      
      const retryBtn = document.getElementById("btn-retry-init");
      if (retryBtn) {
        retryBtn.onclick = () => window.location.reload();
      }
    }
    
    if (splashLoader) splashLoader.style.display = "none";
  };

  try {
    console.time("📡 Service Init");
    const isReady = await SuttaService.init();
    console.timeEnd("📡 Service Init");

    if (!isReady) {
        throw new Error("Sutta Service failed to initialize.");
    }

    const navHeader = document.getElementById("nav-header");
    if (navHeader) navHeader.classList.remove("hidden");
    
    // [FIX]: Bật cả 2 nút Random (Header & Landing)
    const randomBtn = document.getElementById("btn-random");
    if (randomBtn) randomBtn.disabled = false;

    const landingRandomBtn = document.getElementById("btn-landing-random");
    if (landingRandomBtn) landingRandomBtn.disabled = false;

    // Delegate Routing to AppRouter
    await AppRouter.init();

    clearTimeout(initTimeout);
    isReadyHandled = true;
    ViewManager.hideSplashScreen();
    console.timeEnd("🚀 App Start to Ready");

    // [OPTIMIZED] Start heavy background tasks ONLY after the first sutta is loaded and displayed.
    const startBackgroundTasks = () => {
        initLookup();
        OfflineManager.init();
    };

    if (window.requestIdleCallback) {
        window.requestIdleCallback(startBackgroundTasks);
    } else {
        setTimeout(startBackgroundTasks, 500);
    }
  } catch (err) {
    clearTimeout(initTimeout);
    handleInitError(err);
  }
});

