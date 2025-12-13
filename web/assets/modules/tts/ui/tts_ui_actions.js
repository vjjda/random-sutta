// Path: web/assets/modules/tts/ui/tts_ui_actions.js
import { AppConfig } from '../../core/app_config.js';

export const TTSUIActions = {
    bind(orchestrator, renderer) {
        const els = renderer.elements;

        // 1. Magic Corner Trigger: BẮT ĐẦU SESSION
        els.trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            orchestrator.startSession();
        });

        // 2. Close Button: KẾT THÚC SESSION
        els.btnClose.addEventListener("click", (e) => {
            e.stopPropagation();
            orchestrator.endSession();
        });

        // Controls
        els.btnPlay.addEventListener("click", () => orchestrator.togglePlay());
        els.btnPrev.addEventListener("click", () => orchestrator.prev());
        els.btnNext.addEventListener("click", () => orchestrator.next());
        
        els.btnSettings.addEventListener("click", (e) => {
            e.stopPropagation();
            renderer.toggleSettings();
        });

        // Settings Inputs
        els.rateRange.addEventListener("input", (e) => {
            const val = e.target.value;
            renderer.elements.rateVal.textContent = val;
            orchestrator.engine.setRate(val);
        });
        els.voiceSelect.addEventListener("change", (e) => {
            orchestrator.engine.setVoice(e.target.value);
        });
        els.autoNextCheckbox.addEventListener("change", (e) => {
            orchestrator.setAutoNext(e.target.checked);
        });

        document.addEventListener("click", (e) => {
            if (!els.settingsPanel.classList.contains("hidden") && 
                !els.player.contains(e.target)) {
                renderer.closeSettings();
            }
        });

        // [DELETED] Nav Title Double Tap Logic removed here as requested.

        // --- GLOBAL INTERACTIONS ---
        
        // Segment Trigger: Chỉ hoạt động khi Session Active
        const container = document.getElementById("sutta-container");
        if (container) {
            let segmentLastTap = 0;
            
            container.addEventListener("click", (e) => {
                const segment = e.target.closest(".segment");
                
                if (segment) {
                    if (!orchestrator.isSessionActive()) {
                        return; // Bỏ qua nếu chưa bật Player
                    }

                    const now = Date.now();
                    const timeDiff = now - segmentLastTap;

                    // Giữ logic Double Tap cho Segment để tránh conflict chọn text
                    if (timeDiff < 300 && timeDiff > 50) {
                        const selection = window.getSelection();
                        const hasSelection = selection && selection.toString().length > 0;

                        if (!hasSelection) {
                            orchestrator.jumpToID(segment.id);
                            if (selection) selection.removeAllRanges();
                        }
                        segmentLastTap = 0;
                        return;
                    }
                    segmentLastTap = now;
                }
            });
        }
    }
};