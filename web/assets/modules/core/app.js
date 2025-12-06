// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { initFilters, generateBookParam } from '../ui/filters.js';
import { setupQuickNav } from '../ui/search_component.js';
import { SuttaController } from './sutta_controller.js';
import { setupLogging, LogLevel, getLogger } from '../shared/logger.js';
import { DB } from '../data/db_manager.js';

const logger = getLogger("App");

// [VERSIONING] Biến này sẽ được Build System thay thế tự động
// Ví dụ: const APP_VERSION = "v2025.12.06-20.30.00";
const APP_VERSION = "dev-placeholder";

async function runSmartBackgroundDownload() {
    const storedVersion = localStorage.getItem('sutta_offline_version');
    const btnOffline = document.getElementById("btn-download-offline");
    const progressDiv = document.getElementById("offline-progress");

    // 1. Kiểm tra điều kiện
    if (storedVersion === APP_VERSION) {
        logger.info("BackgroundDL", `Cache is up-to-date (${APP_VERSION}). Skipping.`);
        if (btnOffline) {
            btnOffline.textContent = "✅ Offline Ready";
            btnOffline.disabled = true;
        }
        return;
    }

    // 2. Kiểm tra mạng (Tiết kiệm dữ liệu)
    if (navigator.connection && navigator.connection.saveData) {
        logger.warn("BackgroundDL", "Data Saver is on. Skipping auto-download.");
        return;
    }

    logger.info("BackgroundDL", `New version detected (${APP_VERSION}). Starting silent download...`);

    // 3. Cập nhật UI (nếu user mở menu ra xem)
    if (btnOffline) {
        btnOffline.disabled = true;
        btnOffline.textContent = "Auto-downloading...";
    }

    // 4. Thực thi tải ngầm
    try {
        await DB.downloadAll((current, total) => {
            // Update UI nhẹ nhàng (không block main thread)
            if (progressDiv && current % 10 === 0) { // Update mỗi 10 file để đỡ giật
                const percent = Math.round((current / total) * 100);
                progressDiv.textContent = `Syncing: ${percent}%`;
            }
        });

        // 5. Hoàn tất
        localStorage.setItem('sutta_offline_version', APP_VERSION);
        logger.info("BackgroundDL", "✅ Offline sync completed.");
        
        if (btnOffline) {
            btnOffline.textContent = "✅ Offline Ready";
            progressDiv.textContent = "Up to date.";
        }
    } catch (e) {
        logger.error("BackgroundDL", "Sync failed", e);
        if (btnOffline) {
            btnOffline.textContent = "⚠️ Sync Paused";
            btnOffline.disabled = false; // Cho phép user bấm thử lại
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // ... (Giữ nguyên phần Init Config, Logging, DOM Elements cũ) ...
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
    setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

    // UI Elements (Lấy lại reference)
    const statusDiv = document.getElementById("status");
    const navHeader = document.getElementById("nav-header");
    const randomBtn = document.getElementById("btn-random");
    const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
    const filterDrawer = document.getElementById("filter-drawer");

    if (toggleDrawerBtn && filterDrawer) {
        toggleDrawerBtn.addEventListener("click", () => {
            filterDrawer.classList.toggle("hidden");
            toggleDrawerBtn.classList.toggle("open");
        });
    }

    // Expose Window Functions
    window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
    window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

    // Setup QuickNav
    setupQuickNav((query) => SuttaController.loadSutta(query));

    // APP BOOTSTRAP
    try {
        await DB.init();
        statusDiv.classList.add("hidden");
        navHeader.classList.remove("hidden");
        randomBtn.disabled = false;
        initFilters();

        // Routing Logic
        const initialParams = Router.getParams();
        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            SuttaController.loadSutta(loadId, true);
        } else {
            SuttaController.loadRandomSutta(true);
        }

        // [NEW] TRIGGER SMART BACKGROUND DOWNLOAD
        // Chờ 3 giây sau khi app load xong để đảm bảo UI mượt mà, sau đó mới tải ngầm
        setTimeout(() => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => runSmartBackgroundDownload());
            } else {
                runSmartBackgroundDownload();
            }
        }, 3000);

    } catch (err) {
        logger.error('Init', err);
        statusDiv.textContent = "Error loading database.";
    }

    // Global Events
    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));
    window.addEventListener("popstate", (e) => { /* ... Logic cũ ... */ });
    
    // [Modified] Manual Download Button (Cho phép user ép tải lại nếu muốn)
    const btnOffline = document.getElementById("btn-download-offline");
    if (btnOffline) {
        btnOffline.addEventListener("click", () => {
            // Xóa version để ép tải lại
            localStorage.removeItem('sutta_offline_version');
            runSmartBackgroundDownload();
        });
    }
});