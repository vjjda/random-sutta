// Path: web/assets/modules/tts/ui/events.js
export const TTSEvents = {
    bind(manager, view) {
        const els = view.elements;

        // Trigger
        els.trigger.addEventListener("click", () => view.togglePlayer());

        // Controls
        els.btnPlay.addEventListener("click", () => manager.togglePlay());
        els.btnPrev.addEventListener("click", () => manager.prev());
        els.btnNext.addEventListener("click", () => manager.next());
        
        els.btnClose.addEventListener("click", () => {
            manager.stop();
            view.togglePlayer(false);
            view.closeSettings();
        });

        // Settings
        els.btnSettings.addEventListener("click", (e) => {
            e.stopPropagation();
            view.toggleSettings();
        });

        els.rateRange.addEventListener("input", (e) => {
            const val = e.target.value;
            view.elements.rateVal.textContent = val;
            manager.engine.setRate(val);
        });

        els.voiceSelect.addEventListener("change", (e) => {
            manager.engine.setVoice(e.target.value);
        });

        // Click outside settings
        document.addEventListener("click", (e) => {
            if (!els.settingsPanel.classList.contains("hidden") && 
                !els.player.contains(e.target)) {
                view.closeSettings();
            }
        });

        // Double Tap Title
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("dblclick", (e) => {
                const title = e.target.closest("h1.sutta-title");
                if (title) {
                    view.togglePlayer(true);
                }
            });
        }
    }
};