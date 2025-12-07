// Path: web/assets/modules/services/navigation_service.js
import { calculateNavigation } from "../utils/navigator_logic.js";
// [UPDATED]
import { SuttaRepository } from "../data/sutta_repository.js"; 
import { getLogger } from "../utils/logger.js";

const logger = getLogger("NavService");

export const NavigationService = {
  async getNavForSutta(suttaId, localStructure) {
    let nav = calculateNavigation(localStructure, suttaId);

    if (!nav.prev && !nav.next) {
      try {
        // [UPDATED] Gọi Repository
        const superData = await SuttaRepository.fetchStructureData('super_struct');
        if (superData) {
          const superNav = calculateNavigation(superData.structure, suttaId);
          if (superNav.prev || superNav.next) {
            logger.info("getNavForSutta", "Escalated to super_struct");
            return { 
                ...superNav, 
                extraMeta: superData.meta 
            }; 
          }
        }
      } catch (e) {
        logger.warn("getNavForSutta", "Escalation failed", e);
      }
    }
    return nav;
  }
};