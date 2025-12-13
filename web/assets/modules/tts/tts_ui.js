// Path: web/assets/modules/tts/tts_ui.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("TTS_UI");

export const TTSUI = {
    elements: {},
    manager: null,

    init(managerInstance) {
        this.manager = managerInstance;
        this._injectHtml();
        this._bindEvents();
        
        // Bind engine updates
        this.manager.engine.onVoicesChanged = (voices) => {
            this._populateVoiceSelect(voices);
        };
        // Initial populate
        setTimeout(() => {
             this._populateVoiceSelect(this.manager.engine.getVoices());
             this._syncSettingsUI();
        }, 500);
    },

    _injectHtml() {
        if (document.getElementById("magic-tts-trigger")) return;

        const html = `
            <button id="magic-tts-trigger" title="Enable TTS"></button>

            <div id="tts-player">
                <button id="tts-settings-toggle" class="tts-btn" title="Voice Settings">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>

                <button id="tts-prev" class="tts-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                </button>
                
                <button id="tts-play" class="tts-btn tts-btn-main">
                    <svg class="icon-play" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <svg class="icon-pause hidden" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                </button>

                <div class="tts-info" id="tts-info-text">Ready</div>

                <button id="tts-next" class="tts-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                </button>
                
                <button id="tts-close" class="tts-btn" style="color: #ff6b6b">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                <div id="tts-settings-panel" class="hidden">
                    <div class="tts-setting-row">
                        <label>Speed: <span id="tts-rate-val">1.0</span>x</label>
                        <input type="range" id="tts-rate-range" min="0.5" max="2.0" step="0.1" value="1.0">
                    </div>
                    <div class="tts-setting-row">
                        <label>Voice</label>
                        <select id="tts-voice-select"></select>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

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
            // Settings Inputs
            rateRange: document.getElementById("tts-rate-range"),
            rateVal: document.getElementById("tts-rate-val"),
            voiceSelect: document.getElementById("tts-voice-select"),
        };
    },

    _bindEvents() {
        // Trigger Click
        this.elements.trigger.addEventListener("click", () => this.togglePlayer());

        // Player Controls
        this.elements.btnPlay.addEventListener("click", () => this.manager.togglePlay());
        this.elements.btnPrev.addEventListener("click", () => this.manager.prev());
        this.elements.btnNext.addEventListener("click", () => this.manager.next());
        
        this.elements.btnClose.addEventListener("click", () => {
            this.manager.stop();
            this.togglePlayer(false);
            this.elements.settingsPanel.classList.add("hidden"); // Close settings too
        });

        // Settings Toggle
        this.elements.btnSettings.addEventListener("click", (e) => {
            e.stopPropagation();
            this.elements.settingsPanel.classList.toggle("hidden");
        });

        // Settings Inputs
        this.elements.rateRange.addEventListener("input", (e) => {
            const val = e.target.value;
            this.elements.rateVal.textContent = val;
            this.manager.engine.setRate(val);
        });

        this.elements.voiceSelect.addEventListener("change", (e) => {
            this.manager.engine.setVoice(e.target.value);
        });

        // Click outside settings to close
        document.addEventListener("click", (e) => {
            if (!this.elements.settingsPanel.classList.contains("hidden") && 
                !this.elements.player.contains(e.target)) {
                this.elements.settingsPanel.classList.add("hidden");
            }
        });

        // [NEW] Double Tap Title Trigger
        const container = document.getElementById("sutta-container");
        if (container) {
            container.addEventListener("dblclick", (e) => {
                const title = e.target.closest("h1.sutta-title");
                if (title) {
                    this.togglePlayer(true);
                    // Optional: Start playing immediately
                    // this.manager.togglePlay();
                }
            });
        }
    },

    _populateVoiceSelect(voices) {
        if (!voices || voices.length === 0) return;
        
        const select = this.elements.voiceSelect;
        select.innerHTML = "";
        
        voices.forEach(v => {
            const option = document.createElement("option");
            option.value = v.voiceURI;
            // Shorten name for mobile
            option.textContent = v.name.replace("Microsoft ", "").replace("Google ", "").substring(0, 25); 
            select.appendChild(option);
        });

        // Set selected
        if (this.manager.engine.voice) {
            select.value = this.manager.engine.voice.voiceURI;
        }
    },

    _syncSettingsUI() {
        const rate = this.manager.engine.rate;
        this.elements.rateRange.value = rate;
        this.elements.rateVal.textContent = rate;
    },

    togglePlayer(forceState) {
        const isActive = this.elements.player.classList.contains("active");
        const newState = forceState !== undefined ? forceState : !isActive;

        if (newState) {
            this.elements.player.classList.add("active");
        } else {
            this.elements.player.classList.remove("active");
        }
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
    }
};