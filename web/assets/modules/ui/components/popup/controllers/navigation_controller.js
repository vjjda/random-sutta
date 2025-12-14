// Path: web/assets/modules/ui/components/popup/controllers/navigation_controller.js
import { PopupState } from '../state/popup_state.js';

export const NavigationController = {
    handleFullPageNavigation(href, closeAllCallback) {
        // 1. Lưu state hiện tại (Snapshot) vào History của trang hiện tại
        PopupState.saveSnapshot();
        
        // 2. Thực hiện chuyển trang
        this.navigateToMain(href, closeAllCallback);
    },

    navigateToMain(href, closeAllCallback) {
        if (closeAllCallback) closeAllCallback();
        
        const parsed = this.parseUrl(href);
        if (parsed) {
            let loadId = parsed.uid;
            if (parsed.hash) loadId += parsed.hash;
            // Instant scroll for main view navigation
            window.loadSutta(loadId, true, 0, { transition: false });
        }
    },

    parseUrl(href) {
        try {
            const urlObj = new URL(href, window.location.origin);
            let uid = "";
            if (urlObj.searchParams.has("q")) {
                uid = urlObj.searchParams.get("q");
            } else {
                const parts = urlObj.pathname.split('/').filter(p => p);
                if (parts.length > 0) uid = parts[0];
            }
            if (!uid) return null;
            return { uid: uid, hash: urlObj.hash };
        } catch (e) { return null; }
    }
};