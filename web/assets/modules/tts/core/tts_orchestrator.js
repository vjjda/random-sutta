// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSWebSpeechEngine } from '../engines/tts_web_speech_engine.js';
import { TTSStateStore } from './tts_state_store.js';
import { TTSSessionManager } from './tts_session_manager.js'; // [NEW]
import { getLogger } from '../../utils/logger.js';
import { Scroller } from '../../ui/common/scroller.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    engine: null,
    ui: null, 
    onAutoNextRequest: null,

    init() {
        this.engine = new TTSWebSpeechEngine();
        TTSStateStore.init();
        
        // Init Session Manager with dependencies
        TTSSessionManager.init(this.engine, this.ui, {
            activateUI: (idx) => this._activateUI(idx),
            clearHighlight: () => this._clearHighlight(),
            play: () => this.play() // Callback for autoPlay
        });

        logger.info("Init", "Orchestrator Ready");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
        // Update SessionManager's UI reference
        TTSSessionManager.ui = uiInstance;
        
        if (this.ui) {
            this.ui.updateAutoNextState(TTSStateStore.autoNextEnabled);
        }
    },

    setCallbacks(callbacks) {
        if (callbacks && typeof callbacks.onAutoNext === 'function') {
            this.onAutoNextRequest = callbacks.onAutoNext;
        }
    },

    // --- Public Facade (Delegation) ---

    startSession() { TTSSessionManager.start(); },
    endSession() { TTSSessionManager.end(); },
    refreshSession(autoPlay) { TTSSessionManager.refresh(autoPlay); },
    isSessionActive() { return TTSSessionManager.isActive(); },
    isPlaying() { return TTSStateStore.isPlaying; },

    // --- Playback Logic ---

    togglePlay() {
        if (!TTSSessionManager.isActive()) {
            this.startSession();
        }

        // Defensive check
        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
            if (TTSStateStore.playlist.length === 0) return;
        }

        if (TTSStateStore.isPlaying) this.pause();
        else this.play();
    },

    play() {
        TTSStateStore.isPlaying = true;
        if (this.ui) this.ui.updatePlayState(true);
        this._speakCurrent();
    },

    pause() {
        TTSStateStore.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);
        this.engine.pause();
    },

    stop() {
        TTSStateStore.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);
        this.engine.stop();
    },

    next() {
        this.engine.stop();
        if (TTSStateStore.hasNext()) {
            TTSStateStore.advance();
            this._activateUI(TTSStateStore.currentIndex);
            if (TTSStateStore.isPlaying) this._speakCurrent();
        } else {
            this._handlePlaylistEnd();
        }
    },

    prev() {
        this.engine.stop();
        if (TTSStateStore.hasPrev()) {
            TTSStateStore.retreat();
            this._activateUI(TTSStateStore.currentIndex);
            if (TTSStateStore.isPlaying) this._speakCurrent();
        }
    },

    jumpToID(id) {
        if (!TTSSessionManager.isActive()) return;

        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
        }

        const index = TTSStateStore.playlist.findIndex(item => item.id === id);
        if (index !== -1) {
            this.engine.stop(); 
            TTSStateStore.currentIndex = index;
            this._activateUI(index);

            if (!TTSStateStore.isPlaying) this.play();
            else this._speakCurrent();
        }
    },

    setAutoNext(enabled) {
        TTSStateStore.setAutoNext(enabled);
    },

    // --- Internal Logic ---

    _activateUI(index) {
        const item = TTSStateStore.playlist[index];
        if (!item) return;

        this._highlightElement(item.element);
        Scroller.scrollToReadingPosition(item.id);
        
        if (this.ui) {
            this.ui.updateInfo(index + 1, TTSStateStore.playlist.length);
        }
    },

    _speakCurrent() {
        const item = TTSStateStore.getCurrentItem();
        if (!item) return;

        this._activateUI(TTSStateStore.currentIndex);

        this.engine.speak(item.text, () => {
            if (TTSStateStore.isPlaying) {
                if (TTSStateStore.hasNext()) {
                    TTSStateStore.advance();
                    this._speakCurrent();
                } else {
                    this._handlePlaylistEnd();
                }
            }
        });
    },

    async _handlePlaylistEnd() {
        if (TTSStateStore.autoNextEnabled && this.onAutoNextRequest) {
            logger.info("AutoNext", "Playlist ended. Requesting next...");
            if (this.ui) this.ui.updateStatus("Loading next...");

            try {
                await this.onAutoNextRequest();
                // Note: SuttaController triggers refreshSession(true) upon load
                // So we just stop here to be safe
                this.stop(); 
            } catch (e) {
                logger.error("AutoNext", "Failed", e);
                this.stop();
            }
        } else {
            this.stop();
        }
    },

    _highlightElement(el) {
        document.querySelectorAll(".tts-active").forEach(e => e.classList.remove("tts-active"));
        if (el) el.classList.add("tts-active");
    },

    _clearHighlight() {
        document.querySelectorAll(".tts-active").forEach(e => e.classList.remove("tts-active"));
    }
};