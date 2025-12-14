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
  // ... (Các phần khác giữ nguyên) ...

  loadSutta: async function (input, shouldUpdateUrl = true, scrollY = 0, options = {}) {
    const isTransition = options.transition === true;
    const currentScroll = Scroller.getScrollTop();

    // ... (Logic URL & TTS giữ nguyên) ...
    if (shouldUpdateUrl) {
        try {
            const currentState = window.history.state || {};
            window.history.replaceState(
                { ...currentState, scrollY: currentScroll },
                document.title,
                window.location.href
            );
        } catch (e) {}
    }

    PopupAPI.hideAll();
    
    // ... (Stop TTS logic giữ nguyên) ...
    const wasTTSActive = TTSOrchestrator.isSessionActive();
    const wasPlaying = TTSOrchestrator.isPlaying();
    TTSOrchestrator.stop();
    if (!wasTTSActive) {
        TTSOrchestrator.endSession();
    }

    // Parse Input
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

    if (scrollTarget && !scrollTarget.includes(':')) {
        const isSegmentNumber = /^[\d\.]+$/.test(scrollTarget);
        if (isSegmentNumber) {
            scrollTarget = `${suttaId}:${scrollTarget}`;
        }
    }

    logger.info('loadSutta', `Request: ${suttaId}`);
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
            // Redirect -> Tắt transition
            this.loadSutta(redirectId, true, 0, { transition: false });
            logger.timerEnd(`Render: ${suttaId}`);
            return true;
        }
        
        const success = await renderSutta(suttaId, result, options);
        if (success) {
            PopupAPI.scan();
            if (!shouldUpdateUrl) {
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
        // Có hiệu ứng chuyển trang -> Scroll Smooth sau khi render
        await Scroller.transitionTo(performRender, scrollTarget);
    } else {
        // Load trực tiếp/Quicklook -> Scroll Instant
        await performRender();
        if (scrollTarget) {
            // [FIXED] Gọi scrollToId với mode 'instant'
            // setTimeout 0 để đảm bảo stack render xong
            setTimeout(() => Scroller.scrollToId(scrollTarget, 'instant'), 0);
        } else if (scrollY > 0) {
            Scroller.restoreScrollTop(scrollY);
        } else {
            Scroller.restoreScrollTop(0);
        }
    }
  },

  // ... (loadRandomSutta giữ nguyên) ...
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