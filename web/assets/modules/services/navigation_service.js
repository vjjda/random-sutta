// Path: web/assets/modules/services/navigation_service.js
import { calculateNavigation } from "../utils/navigator_logic.js";
import { SuttaRepository } from "../data/sutta_repository.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("NavService");

export const NavigationService = {
  async getNavForSutta(suttaId, localStructure, localMeta = {}) {
    // 1. Tính toán Local (Truyền thêm localMeta)
    let nav = calculateNavigation(localStructure, suttaId, localMeta);

    // 2. Nếu thiếu Prev hoặc Next -> Leo thang lên Super Structure
    if (!nav.prev || !nav.next) {
      try {
        const superData = await SuttaRepository.getSuttaEntry('tpk');
        
        if (superData && superData.bookStructure) {
          logger.info("getNavForSutta", "Escalating to Super Structure...");
          
          // [FIX] Truyền superData.fullMeta vào để logic biết đâu là Branch
          const superNav = calculateNavigation(
              superData.bookStructure, 
              suttaId, 
              superData.fullMeta || {}
          );

          if (!nav.prev) nav.prev = superNav.prev;
          if (!nav.next) nav.next = superNav.next;
          
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