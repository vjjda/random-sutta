// Path: web/assets/modules/ui/components/popup/controllers/navigation_controller.js
import { PopupState } from '../state/popup_state.js';
import { getLogger } from 'utils/logger.js';
const logger = getLogger("NavCtrl");

export const NavigationController = {
    handleFullPageNavigation(href, closeAllCallback) {
        logger.info("Nav", "Saving snapshot before navigation...");
        // 1. Lưu state hiện tại (Snapshot) TRƯỚC TIÊN
        PopupState.saveSnapshot();
        // 2. Thực hiện chuyển trang (Callback này sẽ đóng popup)
        this.navigateToMain(href, closeAllCallback);
    },

    navigateToMain(href, closeAllCallback) {
        // [TELEPORT FIX] Ẩn container NGAY LẬP TỨC trước khi đóng Popup
        // Điều này ngăn người dùng nhìn thấy nội dung cũ hoặc vị trí scroll sai
        // khi Popup vừa biến mất.
        const container = document.getElementById("sutta-container");
        if (container) {
            // Dùng visibility: hidden để giữ layout cho scroller tính toán sau này, 
            // nhưng mắt người dùng không thấy nội dung.
            container.style.visibility = 'hidden';
            
            // Cưỡng chế tắt smooth scroll ngay tại đây để đảm bảo mọi thao tác cuộn ngầm sau đó là instant
            document.documentElement.style.scrollBehavior = 'auto';
        }

        // Đóng Popup (Lúc này lộ ra container đã tàng hình -> User chỉ thấy nền trắng/theme)
        if (closeAllCallback) closeAllCallback();

        const parsed = this.parseUrl(href);
        if (parsed) {
            let loadId = parsed.uid;
            if (parsed.hash) loadId += parsed.hash;
            
            // Gọi loadSutta. 
            // Lưu ý: SuttaController (bản đã fix ở bước trước) sẽ chịu trách nhiệm
            // set visibility = '' (hiện lại) sau khi đã cuộn xong.
            window.loadSutta(loadId, true, 0, { transition: false });
        } else {
            // Fallback: Nếu parse lỗi thì phải hiện lại ngay để tránh treo màn hình trắng
            if (container) container.style.visibility = '';
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