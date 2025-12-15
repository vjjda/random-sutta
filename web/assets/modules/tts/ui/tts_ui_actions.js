// Path: web/assets/modules/tts/ui/tts_ui_actions.js
import { AppConfig } from 'core/app_config.js';
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
            if (orchestrator.isSessionActive()) {
                const isVisible = els.player.classList.contains("active");
                renderer.togglePlayer(!isVisible);
            } else {
                orchestrator.startSession();
            }
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
            // [UX] Reset to main view when opening
            if (els.viewMain && els.viewKeys) {
                els.viewMain.classList.remove('hidden');
                els.viewKeys.classList.add('hidden');
                if (els.btnKeysToggle) els.btnKeysToggle.classList.remove('hidden');
            }
            orchestrator.refreshOfflineVoicesStatus();
            renderer.toggleSettings();
        });

        // [NEW] Keys Management Navigation
        els.btnKeysToggle?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (els.viewMain && els.viewKeys) {
                els.viewMain.classList.add('hidden');
                els.viewKeys.classList.remove('hidden');
                els.btnKeysToggle.classList.add('hidden');
            }
        });

        els.btnKeysBack?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (els.viewMain && els.viewKeys) {
                els.viewKeys.classList.add('hidden');
                els.viewMain.classList.remove('hidden');
                els.btnKeysToggle.classList.remove('hidden');
            }
        });

        // Settings Inputs
        const debouncedSetRate = debounce((val) => orchestrator.engine.setRate(val), 300);
        els.rateRange?.addEventListener("input", (e) => {
            const val = e.target.value;
            if (renderer.elements.rateVal) renderer.elements.rateVal.textContent = val;
            debouncedSetRate(val);
        });

        // [NEW] Rate Buttons Logic
        const adjustRate = (delta) => {
            const input = els.rateRange;
            if (!input) return;
            
            const current = parseFloat(input.value);
            const step = 0.05; // Force fine step for buttons even if slider is different
            const min = parseFloat(input.min);
            const max = parseFloat(input.max);
            
            // Round to avoid float errors (e.g. 1.0500000001)
            let next = Math.round((current + delta) * 100) / 100;
            
            if (next < min) next = min;
            if (next > max) next = max;
            
            if (next !== current) {
                input.value = next;
                input.dispatchEvent(new Event('input')); // Trigger existing listener
            }
        };

        els.btnRateDec?.addEventListener("click", (e) => {
            e.stopPropagation();
            adjustRate(-0.05);
        });

        els.btnRateInc?.addEventListener("click", (e) => {
            e.stopPropagation();
            adjustRate(0.05);
        });

        els.voiceSelect?.addEventListener("change", (e) => {
            orchestrator.setVoice(e.target.value);
        });

        // [LOGGING ADDED] Settings Inputs
        els.autoNextCheckbox?.addEventListener("change", (e) => {
            console.log("UI: Toggled Auto-Next to", e.target.checked); // LOG
            orchestrator.setAutoNext(e.target.checked);
        });
        
        els.modeCheckbox?.addEventListener("change", (e) => {
            const mode = e.target.checked ? 'paragraph' : 'segment';
            console.log("UI: Toggled Mode to", mode); // LOG
            orchestrator.setPlaybackMode(mode);
        });

        // Engine Switching
        els.engineSelect?.addEventListener("change", (e) => {
            const engineId = e.target.value;
            console.log("UI: Switched Engine to", engineId); // LOG
            orchestrator.switchEngine(engineId);
            renderer.updateEngineState(engineId, null);
        });

        // API Key Input
        els.apiKeyInput?.addEventListener("input", (e) => { // Dùng sự kiện 'input' thay vì 'change' để phản hồi tức thì
            const key = e.target.value;
            orchestrator.setGCloudApiKey(key);
            
            // [UX] Ngay khi có key, thử refresh lại list giọng (mở khóa dropdown)
            // Orchestrator sẽ gọi lại updateUI -> populateVoices
            if (key.length > 0) {
                 orchestrator.refreshVoices(); 
            }
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

            // [NEW] Marker Double Click Strategy
            container.addEventListener("dblclick", (e) => {
                const marker = e.target.closest(".tts-marker");
                if (marker) {
                    e.stopPropagation(); // Prevent bubbling
                    const id = marker.getAttribute("data-tts-id");
                    if (id && orchestrator.isSessionActive()) {
                        orchestrator.jumpToID(id);
                        orchestrator.play();
                    }
                    return;
                }
            });
        }
    }
};