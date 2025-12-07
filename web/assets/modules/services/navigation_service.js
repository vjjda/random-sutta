// Path: web/assets/modules/services/navigation_service.js
import { calculateNavigation } from "../utils/navigator_logic.js";
import { SuttaRepository } from "../data/sutta_repository.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("NavService");

export const NavigationService = {
  async getNavForSutta(suttaId, localStructure) {
    // 1. Tính toán Local trước
    let nav = calculateNavigation(localStructure, suttaId);

    // 2. Nếu thiếu Prev hoặc Next -> Leo thang lên Super Structure
    if (!nav.prev || !nav.next) {
      try {
        // [FIX] Gọi hàm đúng từ Repository
        const superData = await SuttaRepository.getSuttaEntry('tpk'); // 'tpk' thường là root id trong super_struct
        
        if (superData && superData.bookStructure) {
          logger.info("getNavForSutta", "Escalating to Super Structure...");
          
          // Tính lại nav trên cây Super
          const superNav = calculateNavigation(superData.bookStructure, suttaId);
          
          // Merge kết quả: Chỉ lấy cái mới nếu cái cũ là null
          // Điều này giúp giữ lại độ chính xác của local (ví dụ subleaf navigation)
          if (!nav.prev) nav.prev = superNav.prev;
          if (!nav.next) nav.next = superNav.next;
          
          // Bổ sung meta nếu có
          if (superData.fullMeta) {
              nav.extraMeta = superData.fullMeta;
          }
        }
      } catch (e) {
        logger.warn("getNavForSutta", "Escalation failed", e);
      }
    }
    return nav;
  }
};