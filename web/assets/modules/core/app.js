// Path: web/assets/modules/core/app.js
import { Router } from './router.js';
import { initFilters } from '../ui/filters.js';
import { setupQuickNav } from '../ui/search_component.js';
import { SuttaController } from './sutta_controller.js';
import { setupLogging, LogLevel, getLogger } from '../shared/logger.js';
import { DB } from '../data/db_manager.js';

const logger = getLogger("App");

// [SVG CONSTANTS] - Giữ nguyên như cũ
const ICONS = {
    DOWNLOAD: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    SYNC: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A11 11 0 0 0 12 2c-6.237 0-11.232 5.26-10.96 11.58C1.4 21.03 8.35 26 15 22.6M2.5 22v-6h6M2.66 18.5a11 11 0 0 0 19.8-7.3"></path></svg>`,
    CHECK: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    ALERT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

const APP_VERSION = "dev-placeholder";

// ... (Giữ nguyên hàm runSmartBackgroundDownload) ...
async function runSmartBackgroundDownload() {
    const storedVersion = localStorage.getItem('sutta_offline_version');
    const btnOffline = document.getElementById("btn-download-offline");
    const progressBar = document.getElementById("offline-progress-bar");
    const wrapper = document.getElementById("offline-wrapper");

    const setUIState = (state, text, iconSvg, percent = 0) => {
        if (wrapper) {
            wrapper.classList.remove("syncing", "ready", "error");
            if (state) wrapper.classList.add(state);
        }
        if (btnOffline) {
            const iconSpan = btnOffline.querySelector(".icon");
            const labelSpan = btnOffline.querySelector(".label");
            if (iconSpan) iconSpan.innerHTML = iconSvg;
            if (labelSpan) labelSpan.textContent = text;
        }
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
    };

    if (storedVersion === APP_VERSION) {
        logger.info("BackgroundDL", `Cache up-to-date (${APP_VERSION}).`);
        setUIState("ready", "Offline Ready", ICONS.CHECK);
        if (btnOffline) btnOffline.disabled = true;
        return;
    }

    if (navigator.connection && navigator.connection.saveData) return;

    logger.info("BackgroundDL", "Starting silent download...");
    setUIState("syncing", "Syncing Library...", ICONS.SYNC, 0);
    if (btnOffline) btnOffline.disabled = true;

    try {
        await DB.downloadAll((current, total) => {
            const percent = Math.round((current / total) * 100);
            if (progressBar) progressBar.style.width = `${percent}%`;
            
            if (percent % 20 === 0 && btnOffline) {
                 const label = btnOffline.querySelector(".label");
                 if(label) label.textContent = `Syncing... ${percent}%`;
            }
        });

        localStorage.setItem('sutta_offline_version', APP_VERSION);
        setUIState("ready", "Offline Ready", ICONS.CHECK);

    } catch (e) {
        logger.error("BackgroundDL", "Sync failed", e);
        setUIState("error", "Retry Download", ICONS.ALERT, 0);
        if (btnOffline) btnOffline.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
    setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

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

    window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
    window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

    setupQuickNav((query) => SuttaController.loadSutta(query));

    try {
        await DB.init();
        statusDiv.classList.add("hidden");
        navHeader.classList.remove("hidden");
        randomBtn.disabled = false;
        initFilters();

        const initialParams = Router.getParams();
        if (initialParams.q) {
            let loadId = initialParams.q;
            if (window.location.hash) loadId += window.location.hash;
            SuttaController.loadSutta(loadId, true);
        } else {
            SuttaController.loadRandomSutta(true);
        }

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

    const btnOffline = document.getElementById("btn-download-offline");
    if (btnOffline) {
        btnOffline.addEventListener("click", () => {
            localStorage.removeItem('sutta_offline_version');
            runSmartBackgroundDownload();
        });
    }

    randomBtn.addEventListener("click", () => SuttaController.loadRandomSutta(true));

    // [FIXED] POPSTATE HANDLER - URL DRIVEN
    window.addEventListener("popstate", (event) => {
        // 1. Luôn đọc URL hiện tại làm chuẩn
        const currentParams = Router.getParams();
        const currentHash = window.location.hash;
        
        // 2. Lấy vị trí scroll đã lưu (nếu có)
        const savedScroll = (event.state && event.state.scrollY) ? event.state.scrollY : 0;
        
        logger.debug('popstate', `Navigating to: ${currentParams.q || 'HOME'} (Scroll: ${savedScroll})`);

        if (currentParams.q) {
            // Có ID -> Load bài kinh đó
            let loadId = currentParams.q;
            if (currentHash) loadId += currentHash;
            
            // shouldUpdateUrl = false (vì URL đã đổi rồi)
            SuttaController.loadSutta(loadId, false, savedScroll, { transition: false });
        } else {
            // Không có ID (về trang chủ) -> Random lại hoặc load trang chủ mặc định
            // shouldUpdateUrl = false (để giữ URL trắng nếu muốn, hoặc đổi sang bài mới)
            SuttaController.loadRandomSutta(false); 
        }
    });
});