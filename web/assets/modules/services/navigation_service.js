// Path: web/assets/modules/services/navigation_service.js
import { calculateNavigation } from "../utils/navigator_logic.js"; // [UPDATED]
import { DB } from "../data/db_manager.js";
import { getLogger } from "../utils/logger.js"; // [UPDATED]

const logger = getLogger("NavService");

export const NavigationService = {
  async getNavForSutta(suttaId, localStructure) {
    let nav = calculateNavigation(localStructure, suttaId);

    if (!nav.prev && !nav.next) {
      try {
        const superData = await DB.fetchStructure('super_struct');
        if (superData) {
          const superNav = calculateNavigation(superData.structure, suttaId);
          if (superNav.prev || superNav.next) {
            logger.info("getNavForSutta", "Escalated to super_struct for navigation.");
            return { 
                ...superNav, 
                extraMeta: superData.meta 
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