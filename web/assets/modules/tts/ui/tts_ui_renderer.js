// Path: web/assets/modules/tts/ui/tts_ui_renderer.js
import { AppConfig } from '../../core/app_config.js';

// [UPDATED] Robust Name Formatter
function formatVoiceName(rawName) {
    // Expected rawName: "en-US-Neural2-D (MALE)" or "en-US-Chirp3-HD-Algenib (MALE)"
    
    // 1. Strip language prefix
    let clean = rawName.replace(/^(en-US-|en-GB-)/, '');
    
    // 2. Format Types
    clean = clean.replace('Neural2', 'Neural 2')
                 .replace('Studio', 'Studio')
                 .replace('Wavenet', 'Wavenet')
                 .replace('Polyglot', 'Polyglot')
                 .replace('Standard', 'Standard');

    // 3. Format Chirp (Handle both Chirp and Chirp3)
    if (clean.includes('Chirp')) {
        clean = clean.replace('Chirp3-HD-', 'Chirp 3 ');
        clean = clean.replace('Chirp-HD-', 'Chirp ');
    } 
    
    // 4. Format Letters (e.g. "-D " -> " D ")
    clean = clean.replace(/-([A-Z])\s/, ' $1 ');
    
    // 5. Remove any remaining dashes that look ugly
    clean = clean.replace(/-/g, ' ');

    return clean;
}

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

        const originalText = infoEl.textContent;
        infoEl.classList.add("error-text");
        infoEl.textContent = message;
        setTimeout(() => {
            infoEl.classList.remove("error-text");
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
                if (!apiKey && this.elements.apiKeyInput) {
                    setTimeout(() => this.elements.apiKeyInput.focus(), 100);
                }
            } else {
                this.elements.apiKeyRow.classList.add('hidden');
            }
        }
        if (this.elements.apiKeyInput) {
            if (apiKey !== null && apiKey !== undefined) {
                this.elements.apiKeyInput.value = apiKey;
            }
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
        const engineSelect = this.elements.engineSelect;
        const apiKeyInput = this.elements.apiKeyInput;
        
        const isGCloud = engineSelect && engineSelect.value === 'gcloud';
        const hasKey = apiKeyInput && apiKeyInput.value.trim().length > 0;

        select.innerHTML = ""; 
        select.disabled = false; 

        if (isGCloud && !hasKey) {
            const option = document.createElement("option");
            option.textContent = "✨ Enter API Key to load voices...";
            option.value = "";
            select.appendChild(option);
            select.disabled = true; 
            return;
        }

        if (isGCloud && hasKey && (!voices || voices.length === 0)) {
            const option = document.createElement("option");
            option.textContent = "⏳ Loading voices or Invalid Key...";
            option.value = "";
            select.appendChild(option);
            select.disabled = true; 
            return;
        }

        if (!voices || voices.length === 0) {
            const option = document.createElement("option");
            option.textContent = "No voices available";
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        // --- Logic Recommended ---
        const recommendedConfig = AppConfig.TTS?.RECOMMENDED_VOICES || [];
        const recommendedMap = new Map(recommendedConfig.map(i => [i.voiceURI, i]));
        
        const recommendedList = [];
        const otherList = [];

        voices.forEach(v => {
            // [CRITICAL] v.voiceURI must be the raw ID (e.g. en-US-Chirp3-HD-Algenib)
            const recEntry = recommendedMap.get(v.voiceURI);
            
            // Format name for display only
            const prettyName = formatVoiceName(v.name);

            if (recEntry) {
                recommendedList.push({
                    ...v,
                    displayName: recEntry.name || ("★ " + prettyName),
                    isRec: true
                });
            } else {
                otherList.push({
                    ...v,
                    displayName: prettyName,
                    isRec: false
                });
            }
        });

        const createOption = (v) => {
            const option = document.createElement("option");
            option.value = v.voiceURI; // [CRITICAL] This sets the value sent to API
            option.dataset.displayName = v.displayName;
            option.textContent = "\u00A0\u00A0\u00A0" + v.displayName; 
            return option;
        };

        if (recommendedList.length > 0) {
            recommendedList.sort((a, b) => {
                const idxA = recommendedConfig.findIndex(c => c.voiceURI === a.voiceURI);
                const idxB = recommendedConfig.findIndex(c => c.voiceURI === b.voiceURI);
                return idxA - idxB;
            });

            recommendedList.forEach(v => select.appendChild(createOption(v)));

            if (otherList.length > 0) {
                const sep = document.createElement("option");
                sep.disabled = true;
                sep.textContent = "──────────";
                select.appendChild(sep);
            }
        }

        otherList.forEach(v => select.appendChild(createOption(v)));

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
            const originalName = opt.dataset.displayName;

            if (originalName) {
                if (offlineSet.has(opt.value)) {
                    opt.textContent = "• " + originalName;
                } else {
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