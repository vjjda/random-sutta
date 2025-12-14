// Path: web/assets/modules/tts/ui/tts_ui_renderer.js
import { AppConfig } from '../../core/app_config.js'; // [NEW] Import config

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

    // [UPDATED] Hỗ trợ Recommended Voices & Phân tách
    populateVoices(voices, currentVoice) {
        if (!this.elements.voiceSelect) return;
        
        const select = this.elements.voiceSelect;
        const engineSelect = this.elements.engineSelect;
        const apiKeyInput = this.elements.apiKeyInput;
        
        const isGCloud = engineSelect && engineSelect.value === 'gcloud';
        const hasKey = apiKeyInput && apiKeyInput.value.trim().length > 0;

        select.innerHTML = ""; 
        select.disabled = false; 

        // CASE 1: GCloud nhưng chưa có Key
        if (isGCloud && !hasKey) {
            const option = document.createElement("option");
            option.textContent = "✨ Enter API Key to load voices...";
            option.value = "";
            select.appendChild(option);
            select.disabled = true; 
            return;
        }

        // CASE 2: Loading / Error
        if (isGCloud && hasKey && (!voices || voices.length === 0)) {
            const option = document.createElement("option");
            option.textContent = "⏳ Loading voices or Invalid Key...";
            option.value = "";
            select.appendChild(option);
            select.disabled = true; 
            return;
        }

        // CASE 3: Render Lists
        if (!voices || voices.length === 0) {
            const option = document.createElement("option");
            option.textContent = "No voices available";
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        // --- Logic Recommended ---
        const recommendedConfig = AppConfig.TTS?.RECOMMENDED_VOICES || [];
        // Map để tra cứu nhanh xem voiceURI có trong recommended không
        const recommendedMap = new Map(recommendedConfig.map(i => [i.voiceURI, i]));
        
        const recommendedList = [];
        const otherList = [];

        voices.forEach(v => {
            const recEntry = recommendedMap.get(v.voiceURI);
            // Clean name logic: Bỏ prefix thừa
            const cleanName = v.name.replace("Microsoft ", "").replace("Google ", "").substring(0, 60);

            if (recEntry) {
                // Nếu là Recommended: Ưu tiên tên Custom trong config
                recommendedList.push({
                    ...v,
                    displayName: recEntry.name || ("★ " + cleanName),
                    isRec: true
                });
            } else {
                otherList.push({
                    ...v,
                    displayName: cleanName,
                    isRec: false
                });
            }
        });

        // Helper render option
        const createOption = (v) => {
            const option = document.createElement("option");
            option.value = v.voiceURI;
            // Lưu tên hiển thị chuẩn vào dataset để dùng cho việc đánh dấu offline (bullet point)
            option.dataset.displayName = v.displayName;
            option.textContent = "\u00A0\u00A0" + v.displayName; // Padding mặc định
            return option;
        };

        // 1. Render Recommended (Sorted by Config Order)
        if (recommendedList.length > 0) {
            // Sort lại theo đúng thứ tự trong Config
            recommendedList.sort((a, b) => {
                const idxA = recommendedConfig.findIndex(c => c.voiceURI === a.voiceURI);
                const idxB = recommendedConfig.findIndex(c => c.voiceURI === b.voiceURI);
                return idxA - idxB;
            });

            recommendedList.forEach(v => select.appendChild(createOption(v)));

            // 2. Separator
            if (otherList.length > 0) {
                const sep = document.createElement("option");
                sep.disabled = true;
                sep.textContent = "──────────";
                select.appendChild(sep);
            }
        }

        // 3. Render Others
        otherList.forEach(v => select.appendChild(createOption(v)));

        if (currentVoice) {
            select.value = currentVoice.voiceURI;
        }
    },

    // [UPDATED] Update marker mà không làm mất Custom Name
    updateVoiceOfflineMarkers(offlineVoiceURIs) {
        if (!this.elements.voiceSelect) return;
        const options = this.elements.voiceSelect.options;
        const offlineSet = new Set(offlineVoiceURIs);
        
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            // Lấy tên hiển thị chuẩn từ dataset (đã lưu ở populateVoices)
            const displayName = opt.dataset.displayName;

            if (displayName) {
                if (offlineSet.has(opt.value)) {
                    opt.textContent = "• " + displayName;
                } else {
                    opt.textContent = "\u00A0\u00A0" + displayName;
                }
            }
        }
    },

    updateRateDisplay(value) {
        if (this.elements.rateRange) this.elements.rateRange.value = value;
        if (this.elements.rateVal) this.elements.rateVal.textContent = value;
    }
};