// Path: web/assets/modules/tts/ui/tts_ui_actions.js
import { AppConfig } from '../../core/app_config.js';

// Simple debounce helper
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

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
        const debouncedSetRate = debounce((val) => orchestrator.engine.setRate(val), 300);
        const debouncedSetPitch = debounce((val) => orchestrator.engine.setPitch(val), 300);

        els.rateRange?.addEventListener("input", (e) => {
            const val = e.target.value;
            if (renderer.elements.rateVal) renderer.elements.rateVal.textContent = val;
            debouncedSetRate(val);
        });

        els.pitchRange?.addEventListener("input", (e) => {
            const val = e.target.value;
            if (renderer.elements.pitchVal) renderer.elements.pitchVal.textContent = val;
            debouncedSetPitch(val);
        });

        els.voiceSelect?.addEventListener("change", (e) => {
            orchestrator.setVoice(e.target.value);
        });
        els.autoNextCheckbox?.addEventListener("change", (e) => {
            orchestrator.setAutoNext(e.target.checked);
        });

        els.modeCheckbox?.addEventListener("change", (e) => {
            const mode = e.target.checked ? 'paragraph' : 'segment';
            orchestrator.setPlaybackMode(mode);
        });

        // Engine Switching
        els.engineSelect?.addEventListener("change", (e) => {
            const engineId = e.target.value;
            orchestrator.switchEngine(engineId);
            // Update UI visibility for API Key
            renderer.updateEngineState(engineId, null);
        });

        // API Key Input
        els.apiKeyInput?.addEventListener("change", (e) => {
            orchestrator.setGCloudApiKey(e.target.value);
        });

        // Refresh Voices
        els.btnRefreshVoices?.addEventListener("click", (e) => {
            e.stopPropagation();
            // Add simple rotation animation
            const svg = e.currentTarget.querySelector("svg");
            if (svg) svg.style.transition = "transform 0.5s";
            if (svg) svg.style.transform = "rotate(180deg)";
            setTimeout(() => { if (svg) svg.style.transform = "rotate(0deg)"; }, 500);
            
            orchestrator.refreshVoices();
        });

        // Click outside to close settings
        document.addEventListener("click", (e) => {
            if (els.settingsPanel && !els.settingsPanel.classList.contains("hidden") && 
                els.player && !els.player.contains(e.target)) {
                renderer.closeSettings();
            }
        });

        // --- GLOBAL INTERACTIONS ---
        
        // Marker Trigger: Handle clicks on generated markers
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("click", (e) => {
                // [NEW] Marker Click Strategy
                const marker = e.target.closest(".tts-marker");
                if (marker) {
                    e.stopPropagation(); // Prevent bubbling
                    const id = marker.getAttribute("data-tts-id");
                    if (id && orchestrator.isSessionActive()) {
                        orchestrator.jumpToID(id);
                    }
                    return;
                }
            });
        }
    }
};