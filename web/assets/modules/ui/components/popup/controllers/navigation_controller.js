// Path: web/assets/modules/ui/components/popup/controllers/navigation_controller.js
import { PopupState } from '../state/popup_state.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("NavCtrl");

export const NavigationController = {
    handleFullPageNavigation(href, closeAllCallback) {
        logger.info("Nav", "Saving snapshot before navigation...");
        
        // 1. [CRITICAL] Lưu state hiện tại (Snapshot) TRƯỚC TIÊN
        // Điều này đảm bảo activeType/Index được lưu khi popup đang mở
        PopupState.saveSnapshot();

        // 2. Thực hiện chuyển trang (Callback này sẽ đóng popup, làm sạch state runtime)
        this.navigateToMain(href, closeAllCallback);
    },

    navigateToMain(href, closeAllCallback) {
        // Callback đóng popup visual (và clear runtime state), nhưng History đã được lưu ở bước 1
        if (closeAllCallback) closeAllCallback();

        const parsed = this.parseUrl(href);
        if (parsed) {
            let loadId = parsed.uid;
            if (parsed.hash) loadId += parsed.hash;
            
            // Instant scroll for main view navigation
            // Hàm này sẽ gọi Router.updateURL -> PushState (tạo entry mới)
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