// Path: web/assets/modules/tts/ui/tts_ui_actions.js
import { AppConfig } from '../../core/app_config.js';

export const TTSUIActions = {
    bind(orchestrator, renderer) {
        const els = renderer.elements;

        // [SAFETY CHECK] Quan trọng: Nếu DOM chưa inject được thì log và thoát
        if (!els.trigger || !els.player) {
            console.error("TTSUIActions: Critical elements missing. Inject failed?");
            return;
        }

        // 1. Magic Corner Trigger
        els.trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            orchestrator.startSession();
        });

        // 2. Close Button
        els.btnClose?.addEventListener("click", (e) => {
            e.stopPropagation();
            orchestrator.endSession();
        });

        // Controls
        els.btnPlay?.addEventListener("click", () => orchestrator.togglePlay());
        els.btnPrev?.addEventListener("click", () => orchestrator.prev());
        els.btnNext?.addEventListener("click", () => orchestrator.next());
        
        els.btnSettings?.addEventListener("click", (e) => {
            e.stopPropagation();
            renderer.toggleSettings();
        });

        // Settings Inputs
        els.rateRange?.addEventListener("input", (e) => {
            const val = e.target.value;
            if (renderer.elements.rateVal) renderer.elements.rateVal.textContent = val;
            orchestrator.engine.setRate(val);
        });
        els.voiceSelect?.addEventListener("change", (e) => {
            orchestrator.engine.setVoice(e.target.value);
        });
        els.autoNextCheckbox?.addEventListener("change", (e) => {
            orchestrator.setAutoNext(e.target.checked);
        });

        els.modeCheckbox?.addEventListener("change", (e) => {
            const mode = e.target.checked ? 'paragraph' : 'segment';
            orchestrator.setPlaybackMode(mode);
        });

        // Click outside to close settings
        document.addEventListener("click", (e) => {
            if (els.settingsPanel && !els.settingsPanel.classList.contains("hidden") && 
                els.player && !els.player.contains(e.target)) {
                renderer.closeSettings();
            }
        });

        // --- GLOBAL INTERACTIONS ---
        
        // Segment Trigger: Chỉ hoạt động khi Session Active
        const container = document.getElementById("sutta-container");
        if (container) {
            let segmentLastTap = 0;
            
            container.addEventListener("click", (e) => {
                const segment = e.target.closest(".segment");
                
                if (segment) {
                    if (!orchestrator.isSessionActive()) {
                        return;
                    }

                    const now = Date.now();
                    const timeDiff = now - segmentLastTap;

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