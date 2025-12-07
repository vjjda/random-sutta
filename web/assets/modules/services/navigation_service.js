// Path: web/assets/modules/services/navigation_service.js
import { calculateNavigation } from "../ui/navigator.js";
import { DB } from "../data/db_manager.js";
import { getLogger } from "../shared/logger.js";

const logger = getLogger("NavService");

export const NavigationService = {
  /**
   * Tính toán điều hướng (Next/Prev) cho một bài kinh.
   * Tự động leo thang lên Super Structure nếu không tìm thấy trong Local Structure.
   */
  async getNavForSutta(suttaId, localStructure) {
    // 1. Tính toán dựa trên cấu trúc cục bộ của sách hiện tại
    let nav = calculateNavigation(localStructure, suttaId);

    // 2. Logic Leo thang (Escalation)
    // Nếu local nav rỗng (đứng một mình), thử tìm hàng xóm trong Super Struct (Toàn thư)
    if (!nav.prev && !nav.next) {
      try {
        const superData = await DB.fetchStructure('super_struct');
        if (superData) {
          const superNav = calculateNavigation(superData.structure, suttaId);
          if (superNav.prev || superNav.next) {
            logger.info("getNavForSutta", "Escalated to super_struct for navigation.");
            return { 
                ...superNav, 
                extraMeta: superData.meta // Trả kèm meta để Controller merge hiển thị tên
            }; 
          }
        }
      } catch (e) {
        logger.warn("getNavForSutta", "Escalation to super_struct failed", e);
      }
    }
    
    return nav;
  }
};