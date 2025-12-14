// Path: web/assets/modules/tts/ui/renderers/player_controls_renderer.js
export const TTSPlayerControlsRenderer = {
    togglePlayer(elements, forceState) {
        if (!elements.player) return;
        const isActive = elements.player.classList.contains("active");
        const newState = forceState !== undefined ? forceState : !isActive;
        
        if (newState) elements.player.classList.add("active");
        else elements.player.classList.remove("active");
    },

    updatePlayState(elements, isPlaying) {
        if (!elements.iconPlay || !elements.iconPause) return;
        if (isPlaying) {
            elements.iconPlay.classList.add("hidden");
            elements.iconPause.classList.remove("hidden");
        } else {
            elements.iconPlay.classList.remove("hidden");
            elements.iconPause.classList.add("hidden");
        }
    },

    updateInfo(elements, current, total) {
        if (elements.infoText) elements.infoText.textContent = `${current} / ${total}`;
    },

    updateStatus(elements, text) {
        if (elements.infoText) elements.infoText.textContent = text;
    },

    showError(elements, message, duration = 5000) {
        const infoEl = elements.infoText;
        if (!infoEl) return;

        const originalText = infoEl.textContent;
        infoEl.classList.add("error-text");
        infoEl.textContent = message;
        setTimeout(() => {
            infoEl.classList.remove("error-text");
            if (infoEl.textContent === message) infoEl.textContent = originalText;
        }, duration);
    }
};