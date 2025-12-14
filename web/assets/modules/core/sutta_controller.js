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

    // 1. Update URL State (Preserving History)
    if (shouldUpdateUrl) {
        try {
            const bookParam = FilterComponent.generateBookParam();
            // Router đã được fix để dùng replaceState bảo toàn popupSnapshot
            Router.updateURL(null, bookParam, false, null, currentScroll);
        } catch (e) {}
    }

    // 2. Hide Popups (Visual Reset)
    // Lưu ý: Việc này chỉ ẩn giao diện, không xóa history state
    PopupAPI.hideAll();

    // 3. Handle TTS
    const wasTTSActive = TTSOrchestrator.isSessionActive();
    const wasPlaying = TTSOrchestrator.isPlaying();
    TTSOrchestrator.stop();
    if (!wasTTSActive) {
        TTSOrchestrator.endSession();
    }

    // 4. Parse Input
    let suttaId;
    let scrollTarget = null;
    if (typeof input === 'object') {
        suttaId = input.uid;
    } else {
        const parts = input.split('#');
        suttaId = parts[0].trim().toLowerCase();
        if (parts.length > 1) {
            scrollTarget = parts[1];
        }
    }

    // Normalized segment ID format (e.g. dn1:1.1)
    if (scrollTarget && !scrollTarget.includes(':')) {
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) {
            scrollTarget = `${suttaId}:${scrollTarget}`;
        }
    }

    logger.info('loadSutta', `Request: ${suttaId} (URL update: ${shouldUpdateUrl})`);
    logger.timer(`Render: ${suttaId}`);

    const performRender = async () => {
        const result = await SuttaService.loadSutta(suttaId);
        
        // Handle Error / Not Found
        if (!result) {
            renderSutta(suttaId, null, null, options);
            logger.timerEnd(`Render: ${suttaId}`);
            return false;
        }

        // Handle Redirect (Alias)
        if (result.isAlias) {
            let redirectId = result.targetUid;
            if (result.hashId) redirectId += `#${result.hashId}`;
            this.loadSutta(redirectId, true, 0, { transition: false });
            logger.timerEnd(`Render: ${suttaId}`);
            return true;
        }
        
        // Render Content
        const success = await renderSutta(suttaId, result, options);
        
        if (success) {
            // [CRITICAL] Scan comments immediately
            PopupAPI.scan();

            // [CRITICAL] Restore Popup Logic
            // shouldUpdateUrl = false nghĩa là đang Back/Forward (popstate)
            // Lúc này cần kiểm tra History Snapshot để khôi phục popup cũ
            if (!shouldUpdateUrl) {
                logger.debug("SuttaController", "Triggering popup restore...");
                PopupAPI.restore();
            }

            // Restore TTS Session if needed
            if (wasTTSActive) {
                setTimeout(() => {
                    TTSOrchestrator.refreshSession(wasPlaying);
                }, 100);
            }
        }

        // Push new State if needed
        if (success && shouldUpdateUrl) {
             const bookParam = FilterComponent.generateBookParam();
             Router.updateURL(suttaId, bookParam, false, scrollTarget ? `#${scrollTarget}` : null, currentScroll);
        }
        
        logger.timerEnd(`Render: ${suttaId}`);
        return success;
    };

    // Execute Scroll/Transition Strategy
    if (isTransition) {
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        await performRender();
        if (scrollTarget) {
            // Use setTimeout 0 to ensure DOM paint
            setTimeout(() => {
                // [UPDATED] Use Instant Jump
                Scroller.jumpTo(scrollTarget);
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