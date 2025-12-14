// Path: web/assets/modules/core/sutta_controller.js
import { SuttaService } from "services/sutta_service.js";
import { RandomBuffer } from "services/random_buffer.js";
import { renderSutta } from "ui/views/renderer.js";
import { Router } from "core/router.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { initPopupSystem } from "ui/components/popup/index.js";
import { Scroller } from "ui/common/scroller.js";
import { getLogger } from "utils/logger.js";
import { TTSOrchestrator } from "tts/core/tts_orchestrator.js";

const logger = getLogger("SuttaController");
const PopupAPI = initPopupSystem();

export const SuttaController = {
  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    const currentScroll = Scroller.getScrollTop();

    if (shouldUpdateUrl) {
        // [NOTE] Router.updateURL now correctly preserves popupSnapshot via replaceState
        try {
            const bookParam = FilterComponent.generateBookParam();
            Router.updateURL(null, bookParam, false, null, currentScroll);
        } catch (e) {}
    }

    // 1. Hide popups initially (Clean slate visual)
    // IMPORTANT: This clears runtime state, BUT we are relying on History State for restore
    PopupAPI.hideAll();

    const wasTTSActive = TTSOrchestrator.isSessionActive();
    const wasPlaying = TTSOrchestrator.isPlaying();
    TTSOrchestrator.stop();
    if (!wasTTSActive) {
        TTSOrchestrator.endSession();
    }

    // Parse Input logic ...
    let suttaId;
    let scrollTarget = null;
    if (typeof input === 'object') {
        suttaId = input.uid;
    } else {
        const parts = input.split('#');
        suttaId = parts[0].trim().toLowerCase();
        if (parts.length > 1) scrollTarget = parts[1];
    }

    if (scrollTarget && !scrollTarget.includes(':')) {
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) scrollTarget = `${suttaId}:${scrollTarget}`;
    }

    logger.info('loadSutta', `Request: ${suttaId} (URL update: ${shouldUpdateUrl})`);
    logger.timer(`Render: ${suttaId}`);

    const performRender = async () => {
        const result = await SuttaService.loadSutta(suttaId);
        if (!result) {
            renderSutta(suttaId, null, null, options);
            logger.timerEnd(`Render: ${suttaId}`);
            return false;
        }

        if (result.isAlias) {
            let redirectId = result.targetUid;
            if (result.hashId) redirectId += `#${result.hashId}`;
            this.loadSutta(redirectId, true, 0, { transition: false });
            logger.timerEnd(`Render: ${suttaId}`);
            return true;
        }
        
        const success = await renderSutta(suttaId, result, options);
        
        if (success) {
            // [CRITICAL] Scan immediately after render
            PopupAPI.scan();

            // [CRITICAL] Restore Logic
            // shouldUpdateUrl = false nghĩa là đang Back/Forward (popstate)
            // Lúc này ta kiểm tra xem trong History có Snapshot không để khôi phục
            if (!shouldUpdateUrl) {
                logger.debug("SuttaController", "Triggering popup restore...");
                PopupAPI.restore();
            }

            if (wasTTSActive) {
                setTimeout(() => {
                    TTSOrchestrator.refreshSession(wasPlaying);
                }, 100);
            }
        }

        if (success && shouldUpdateUrl) {
             const bookParam = FilterComponent.generateBookParam();
             Router.updateURL(suttaId, bookParam, false, scrollTarget ? `#${scrollTarget}` : null, currentScroll);
        }
        
        logger.timerEnd(`Render: ${suttaId}`);
        return success;
    };

    if (isTransition) {
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        await performRender();
        if (scrollTarget) {
            setTimeout(() => {
                Scroller.scrollToId(scrollTarget, 'instant');
                Scroller.highlightElement(scrollTarget);
            }, 0);
        } else if (scrollY > 0) {
            Scroller.restoreScrollTop(scrollY);
        } else {
            Scroller.restoreScrollTop(0);
        }
    }
  },

  loadRandomSutta: async function (shouldUpdateUrl = true) {
    PopupAPI.hideAll();
    logger.timer('Random Process Total');

    const filters = FilterComponent.getActiveFilters();
    const payload = await RandomBuffer.getPayload(filters);
    if (!payload) {
      alert("Database loading or no suttas found.");
      logger.timerEnd('Random Process Total');
      return;
    }
    
    logger.info('loadRandom', `Selected: ${payload.uid}`);
    await this.loadSutta(payload, shouldUpdateUrl, 0, { transition: false });
    logger.timerEnd('Random Process Total');
  }
};