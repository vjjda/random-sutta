// Path: web/assets/modules/tts/ui/tts_ui_actions.js
export const TTSUIActions = {
    bind(orchestrator, renderer) {
        const els = renderer.elements;

        els.trigger.addEventListener("click", () => renderer.togglePlayer());

        els.btnPlay.addEventListener("click", () => orchestrator.togglePlay());
        els.btnPrev.addEventListener("click", () => orchestrator.prev());
        els.btnNext.addEventListener("click", () => orchestrator.next());
        
        els.btnClose.addEventListener("click", () => {
            orchestrator.stop();
            renderer.togglePlayer(false);
            renderer.closeSettings();
        });

        els.btnSettings.addEventListener("click", (e) => {
            e.stopPropagation();
            renderer.toggleSettings();
        });

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

        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("dblclick", (e) => {
                const title = e.target.closest("h1.sutta-title");
                if (title) {
                    renderer.togglePlayer(true);
                }
            });
        }
    }
};