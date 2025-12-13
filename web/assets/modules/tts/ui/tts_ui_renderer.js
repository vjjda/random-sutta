// Path: web/assets/modules/tts/ui/tts_ui_renderer.js
export const TTSUIRenderer = {
    elements: {},

    cacheElements() {
        this.elements = {
            trigger: document.getElementById("magic-tts-trigger"),
            player: document.getElementById("tts-player"),
            btnSettings: document.getElementById("tts-settings-toggle"),
            settingsPanel: document.getElementById("tts-settings-panel"),
            btnPlay: document.getElementById("tts-play"),
            btnPrev: document.getElementById("tts-prev"),
            btnNext: document.getElementById("tts-next"),
            btnClose: document.getElementById("tts-close"),
            iconPlay: document.querySelector("#tts-play .icon-play"),
            iconPause: document.querySelector("#tts-play .icon-pause"),
            infoText: document.getElementById("tts-info-text"),
            rateRange: document.getElementById("tts-rate-range"),
            rateVal: document.getElementById("tts-rate-val"),
            voiceSelect: document.getElementById("tts-voice-select"),
            autoNextCheckbox: document.getElementById("tts-auto-next"),
        };
        return this.elements;
    },

    togglePlayer(forceState) {
        const isActive = this.elements.player.classList.contains("active");
        const newState = forceState !== undefined ? forceState : !isActive;
        if (newState) this.elements.player.classList.add("active");
        else this.elements.player.classList.remove("active");
    },

    updatePlayState(isPlaying) {
        if (isPlaying) {
            this.elements.iconPlay.classList.add("hidden");
            this.elements.iconPause.classList.remove("hidden");
        } else {
            this.elements.iconPlay.classList.remove("hidden");
            this.elements.iconPause.classList.add("hidden");
        }
    },

    updateInfo(current, total) {
        this.elements.infoText.textContent = `${current} / ${total}`;
    },

    updateStatus(text) {
        this.elements.infoText.textContent = text;
    },

    updateAutoNextState(isChecked) {
        if (this.elements.autoNextCheckbox) {
            this.elements.autoNextCheckbox.checked = isChecked;
        }
    },

    toggleSettings() {
        this.elements.settingsPanel.classList.toggle("hidden");
    },

    closeSettings() {
        this.elements.settingsPanel.classList.add("hidden");
    },

    populateVoices(voices, currentVoice) {
        if (!voices || voices.length === 0) return;
        const select = this.elements.voiceSelect;
        select.innerHTML = "";
        
        voices.forEach(v => {
            const option = document.createElement("option");
            option.value = v.voiceURI;
            option.textContent = v.name.replace("Microsoft ", "").replace("Google ", "").substring(0, 25); 
            select.appendChild(option);
        });

        if (currentVoice) select.value = currentVoice.voiceURI;
    },

    updateRateDisplay(value) {
        this.elements.rateRange.value = value;
        this.elements.rateVal.textContent = value;
    }
};