// Path: web/assets/modules/tts/ui/tts_ui_renderer.js
import { TTSVoiceListRenderer } from './renderers/voice_list_renderer.js';
import { TTSSettingsRenderer } from './renderers/settings_renderer.js';
import { TTSPlayerControlsRenderer } from './renderers/player_controls_renderer.js';

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
            btnRateDec: document.getElementById("tts-rate-dec"), // [NEW]
            btnRateInc: document.getElementById("tts-rate-inc"), // [NEW]
            voiceSelect: document.getElementById("tts-voice-select"),
            btnRefreshVoices: document.getElementById("tts-refresh-voices"),
            autoNextCheckbox: document.getElementById("tts-auto-next"),
            modeCheckbox: document.getElementById("tts-mode-toggle"),
            engineSelect: document.getElementById("tts-engine-select"),
            apiKeyRow: document.getElementById("tts-apikey-row"),
            apiKeyInput: document.getElementById("tts-apikey-input"),
            
            // [NEW] Keys Management
            btnKeysToggle: document.getElementById("tts-keys-toggle"),
            btnKeysBack: document.getElementById("tts-keys-back"),
            viewMain: document.getElementById("tts-settings-main"),
            viewKeys: document.getElementById("tts-settings-keys"),
        };
        return this.elements;
    },

    // --- Delegation ---

    // Player
    togglePlayer(forceState) { TTSPlayerControlsRenderer.togglePlayer(this.elements, forceState); },
    updatePlayState(isPlaying) { TTSPlayerControlsRenderer.updatePlayState(this.elements, isPlaying); },
    updateInfo(current, total) { TTSPlayerControlsRenderer.updateInfo(this.elements, current, total); },
    updateStatus(text) { TTSPlayerControlsRenderer.updateStatus(this.elements, text); },
    showError(msg) { TTSPlayerControlsRenderer.showError(this.elements, msg); },

    // Settings
    updateEngineState(engineId, apiKey) { TTSSettingsRenderer.updateEngineState(this.elements, engineId, apiKey); },
    updateRateDisplay(val) { TTSSettingsRenderer.updateRate(this.elements, val); },
    updateAutoNextState(v) { TTSSettingsRenderer.updateToggles(this.elements, v, null); },
    updatePlaybackModeState(v) { TTSSettingsRenderer.updateToggles(this.elements, null, v); },
    toggleSettings() { TTSSettingsRenderer.togglePanel(this.elements); },
    closeSettings() { TTSSettingsRenderer.togglePanel(this.elements, false); },

    // Voice List
    populateVoices(voices, currentVoice) { 
        const engineId = this.elements.engineSelect?.value;
        const hasKey = this.elements.apiKeyInput?.value.trim().length > 0;
        const isGCloud = engineId === 'gcloud';
        
        TTSVoiceListRenderer.render(this.elements.voiceSelect, voices, currentVoice, isGCloud, hasKey); 
    },
    updateVoiceOfflineMarkers(list) { TTSVoiceListRenderer.updateOfflineMarkers(this.elements.voiceSelect, list); }
};