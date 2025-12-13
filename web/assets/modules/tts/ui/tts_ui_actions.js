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

        // --- SEGMENT TRIGGER & TITLE DOUBLE TAP ---
        const container = document.getElementById("sutta-container");
        if (container) {
            let lastTapTime = 0;
            
            container.addEventListener("click", (e) => {
                const now = Date.now();
                const timeDiff = now - lastTapTime;
                
                // Logic 1: Double Tap Title để mở Player (đã có từ trước)
                const title = e.target.closest("h1.sutta-title");
                if (title && timeDiff < 300 && timeDiff > 50) {
                    renderer.togglePlayer(true);
                    lastTapTime = 0;
                    return;
                }

                // Logic 2: Double Tap Segment để nhảy (Jump to Segment)
                const segment = e.target.closest(".segment");
                
                if (segment && timeDiff < 300 && timeDiff > 50) {
                    // [CONFLICT CHECK] Kiểm tra xem user có đang bôi đen text không
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;

                    if (!hasSelection) {
                        // Nếu không bôi đen -> Kích hoạt TTS Jump
                        orchestrator.jumpToID(segment.id);
                        
                        // [UX] Reset selection để tránh bị bôi đen do thao tác double click
                        if (selection) selection.removeAllRanges();
                    }
                    
                    lastTapTime = 0;
                    return;
                }

                lastTapTime = now;
            });
        }
    }
};