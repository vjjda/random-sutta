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

    showError(message, duration = 5000) {
        const infoEl = this.elements.infoText;
        if (!infoEl) return;

        // Save current state to revert back to
        const originalText = infoEl.textContent;

        // Apply error state
        infoEl.classList.add("error-text");
        infoEl.textContent = message;

        // Revert after duration
        setTimeout(() => {
            infoEl.classList.remove("error-text");
            // Check if the text is still our error message before reverting
            if (infoEl.textContent === message) {
                infoEl.textContent = originalText;
            }
        }, duration);
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
                
                // [UX] Auto focus if key is missing
                if (!apiKey && this.elements.apiKeyInput) {
                    setTimeout(() => this.elements.apiKeyInput.focus(), 100);
                }
            } else {
                this.elements.apiKeyRow.classList.add('hidden');
            }
        }
        if (this.elements.apiKeyInput) {
            // Chỉ set value nếu có apiKey truyền vào (để tránh overwrite khi đang gõ)
            if (apiKey !== null && apiKey !== undefined) {
                this.elements.apiKeyInput.value = apiKey;
            }
        }
        
        // [QUAN TRỌNG] Trigger lại UI giọng đọc để áp dụng logic khóa/mở
        // Tuy nhiên populateVoices cần danh sách voices. 
        // Logic này tốt nhất nên nằm ở Orchestrator hoặc Action binding.
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
        const engineSelect = this.elements.engineSelect;
        const apiKeyInput = this.elements.apiKeyInput;
        
        // [LOGIC MỚI] Kiểm tra xem có phải GCloud và thiếu Key không
        const isGCloud = engineSelect && engineSelect.value === 'gcloud';
        const hasKey = apiKeyInput && apiKeyInput.value.trim().length > 0;

        select.innerHTML = ""; // Clear old options
        select.disabled = false; // Reset state

        // TRƯỜNG HỢP 1: GCloud nhưng chưa có Key
        if (isGCloud && !hasKey) {
            const option = document.createElement("option");
            option.textContent = "✨ Enter API Key to load voices...";
            option.value = "";
            select.appendChild(option);
            select.disabled = true; // Khóa menu lại
            return; // Dừng, không render danh sách fallback
        }

        // TRƯỜNG HỢP 2: Render danh sách bình thường (WSA hoặc GCloud đã có Key)
        if (!voices || voices.length === 0) {
            const option = document.createElement("option");
            option.textContent = "No voices available";
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        voices.forEach(v => {
            const option = document.createElement("option");
            option.value = v.voiceURI;
            
            // Clean name logic
            const cleanName = v.name.replace("Microsoft ", "").replace("Google ", "").substring(0, 60);
            option.dataset.originalName = cleanName;
            option.textContent = "\u00A0\u00A0\u00A0" + cleanName; 
            
            select.appendChild(option);
        });

        if (currentVoice) {
            select.value = currentVoice.voiceURI;
        }
    },

    updateVoiceOfflineMarkers(offlineVoiceURIs) {
        if (!this.elements.voiceSelect) return;
        const options = this.elements.voiceSelect.options;
        const offlineSet = new Set(offlineVoiceURIs);
        
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const originalName = opt.dataset.originalName;

            // Always work from the clean original name stored in the dataset
            if (originalName) {
                if (offlineSet.has(opt.value)) {
                    // Prepend bullet for offline voices
                    opt.textContent = "• " + originalName;
                } else {
                    // Prepend non-breaking spaces for alignment for online voices
                    opt.textContent = "\u00A0\u00A0\u00A0" + originalName;
                }
            }
        }
    },

    updateRateDisplay(value) {
        if (this.elements.rateRange) this.elements.rateRange.value = value;
        if (this.elements.rateVal) this.elements.rateVal.textContent = value;
    }
};