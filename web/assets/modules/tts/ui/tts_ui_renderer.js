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
            btnRefreshVoices: document.getElementById("tts-refresh-voices"),
            autoNextCheckbox: document.getElementById("tts-auto-next"),
            modeCheckbox: document.getElementById("tts-mode-toggle"),
            engineSelect: document.getElementById("tts-engine-select"),
            apiKeyRow: document.getElementById("tts-apikey-row"),
            apiKeyInput: document.getElementById("tts-apikey-input"),
        };
        return this.elements;
    },

    togglePlayer(forceState) {
        if (!this.elements.player) return;
        const isActive = this.elements.player.classList.contains("active");
        const newState = forceState !== undefined ? forceState : !isActive;
        if (newState) this.elements.player.classList.add("active");
        else this.elements.player.classList.remove("active");
    },

    updatePlayState(isPlaying) {
        if (!this.elements.iconPlay || !this.elements.iconPause) return;
        if (isPlaying) {
            this.elements.iconPlay.classList.add("hidden");
            this.elements.iconPause.classList.remove("hidden");
        } else {
            this.elements.iconPlay.classList.remove("hidden");
            this.elements.iconPause.classList.add("hidden");
        }
    },

    updateInfo(current, total) {
        if (this.elements.infoText) {
            this.elements.infoText.textContent = `${current} / ${total}`;
        }
    },

    updateStatus(text) {
        if (this.elements.infoText) {
            this.elements.infoText.textContent = text;
        }
    },

    updateAutoNextState(isChecked) {
        if (this.elements.autoNextCheckbox) {
            this.elements.autoNextCheckbox.checked = isChecked;
        }
    },

    updatePlaybackModeState(isParagraph) {
        if (this.elements.modeCheckbox) {
            this.elements.modeCheckbox.checked = isParagraph;
        }
    },

    updateEngineState(engineId, apiKey) {
        if (this.elements.engineSelect) {
            this.elements.engineSelect.value = engineId;
        }
        if (this.elements.apiKeyRow) {
            if (engineId === 'gcloud') {
                this.elements.apiKeyRow.classList.remove('hidden');
            } else {
                this.elements.apiKeyRow.classList.add('hidden');
            }
        }
        if (this.elements.apiKeyInput && apiKey) {
            this.elements.apiKeyInput.value = apiKey;
        }
    },

    toggleSettings() {
        this.elements.settingsPanel?.classList.toggle("hidden");
    },

    closeSettings() {
        this.elements.settingsPanel?.classList.add("hidden");
    },

    populateVoices(voices, currentVoice) {
        if (!this.elements.voiceSelect) return;
        const select = this.elements.voiceSelect;
        console.log("[DEBUG] Clearing and Populating Voices. Count:", voices.length);
        select.innerHTML = ""; // Clear previous options
        
        voices.forEach(v => {
            const option = document.createElement("option");
            option.value = v.voiceURI;
            
            // 1. Store the clean, original name without any prefixes.
            const cleanName = v.name.replace("Microsoft ", "").replace("Google ", "").substring(0, 60);
            option.dataset.originalName = cleanName;
            
            // 2. Set a default padded state. Use non-breaking spaces to prevent trimming.
            option.textContent = "\u00A0\u00A0" + cleanName; 
            console.log(`[DEBUG] populateVoices: Set initial text for ${v.voiceURI} to "${option.textContent}"`);
            
            select.appendChild(option);
        });

        if (currentVoice) {
            select.value = currentVoice.voiceURI;
        }
    },

    updateVoiceOfflineMarkers(offlineVoiceURIs) {
        if (!this.elements.voiceSelect) return;
        console.log("[DEBUG] Updating Offline Markers. Offline URIs:", offlineVoiceURIs);
        const options = this.elements.voiceSelect.options;
        const offlineSet = new Set(offlineVoiceURIs);
        
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const originalName = opt.dataset.originalName;

            // Always work from the clean original name stored in the dataset
            if (originalName) {
                const isOffline = offlineSet.has(opt.value);
                console.log(`[DEBUG] updateMarkers: Checking ${opt.value}. Is Offline: ${isOffline}. Original Name: "${originalName}". Current textContent: "${opt.textContent}"`);
                if (isOffline) {
                    // Prepend checkmark for offline voices
                    opt.textContent = "✓ " + originalName;
                } else {
                    // Prepend non-breaking spaces for alignment for online voices
                    opt.textContent = "\u00A0\u00A0" + originalName;
                }
                console.log(`[DEBUG] updateMarkers: New textContent for ${opt.value} is "${opt.textContent}"`);
            } else {
                console.warn(`[DEBUG] updateMarkers: Option ${opt.value} is missing originalName dataset!`);
            }
        }
    },

    updateRateDisplay(value) {
        if (this.elements.rateRange) this.elements.rateRange.value = value;
        if (this.elements.rateVal) this.elements.rateVal.textContent = value;
    }
};