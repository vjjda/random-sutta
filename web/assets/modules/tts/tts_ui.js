// Path: web/assets/modules/tts/tts_ui.js
import { getLogger } from '../utils/logger.js'; // [FIXED] Correct path

const logger = getLogger("TTS_UI");

export const TTSUI = {
    elements: {},
    manager: null, // Inject manager later

    init(managerInstance) {
        this.manager = managerInstance;
        this._injectHtml();
        this._bindEvents();
    },

    _injectHtml() {
        // Inject Trigger & Player vào body nếu chưa có
        if (document.getElementById("magic-tts-trigger")) return;

        const html = `
            <button id="magic-tts-trigger" title="Enable Text-to-Speech"></button>

            <div id="tts-player">
                <button id="tts-prev" class="tts-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                </button>
                
                <button id="tts-play" class="tts-btn tts-btn-main">
                    <svg class="icon-play" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <svg class="icon-pause hidden" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                </button>

                <div class="tts-info" id="tts-info-text">Ready to Read</div>

                <button id="tts-next" class="tts-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                </button>
                
                <button id="tts-close" class="tts-btn" style="color: #ff6b6b">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        this.elements = {
            trigger: document.getElementById("magic-tts-trigger"),
            player: document.getElementById("tts-player"),
            btnPlay: document.getElementById("tts-play"),
            btnPrev: document.getElementById("tts-prev"),
            btnNext: document.getElementById("tts-next"),
            btnClose: document.getElementById("tts-close"),
            iconPlay: document.querySelector("#tts-play .icon-play"),
            iconPause: document.querySelector("#tts-play .icon-pause"),
            infoText: document.getElementById("tts-info-text")
        };
    },

    _bindEvents() {
        // Trigger Logic
        this.elements.trigger.addEventListener("click", () => {
            this.togglePlayer();
        });

        // Player Controls
        this.elements.btnPlay.addEventListener("click", () => this.manager.togglePlay());
        this.elements.btnPrev.addEventListener("click", () => this.manager.prev());
        this.elements.btnNext.addEventListener("click", () => this.manager.next());
        
        this.elements.btnClose.addEventListener("click", () => {
            this.manager.stop();
            this.togglePlayer(false);
        });
    },

    togglePlayer(forceState) {
        const isActive = this.elements.player.classList.contains("active");
        const newState = forceState !== undefined ? forceState : !isActive;

        if (newState) {
            this.elements.player.classList.add("active");
            // Auto play if opening? Maybe not, let user decide.
            // this.manager.scanContent(); // Pre-scan
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
        this.elements.infoText.textContent = `Segment ${current} / ${total}`;
    }
};