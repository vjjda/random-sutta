// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSWebSpeechEngine } from '../engines/tts_web_speech_engine.js';
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { getLogger } from '../../utils/logger.js';
import { Scroller } from '../../ui/common/scroller.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    engine: null,
    ui: null, // Interface: updateInfo, updatePlayState, updateAutoNextState
    onAutoNextRequest: null,

    init() {
        this.engine = new TTSWebSpeechEngine();
        TTSStateStore.init();
        logger.info("Init", "Orchestrator Ready");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
        // Sync Initial State
        if (this.ui) {
            this.ui.updateAutoNextState(TTSStateStore.autoNextEnabled);
        }
    },

    setCallbacks(callbacks) {
        if (callbacks && typeof callbacks.onAutoNext === 'function') {
            this.onAutoNextRequest = callbacks.onAutoNext;
        }
    },

    // --- Actions ---

    togglePlay() {
        // Lazy Load Playlist
        if (TTSStateStore.playlist.length === 0) {
            const items = TTSDOMParser.parse("sutta-container");
            if (items.length === 0) return;
            
            TTSStateStore.resetPlaylist(items);
            this._activateUI(0); // Highlight first item immediately
        }

        if (TTSStateStore.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
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
        this._clearHighlight();
    },

    next() {
        this.engine.stop(); // Stop audio immediately
        
        if (TTSStateStore.hasNext()) {
            TTSStateStore.advance();
            this._activateUI(TTSStateStore.currentIndex);
            
            // Nếu đang play thì đọc luôn, nếu pause thì chỉ chuyển highlight
            if (TTSStateStore.isPlaying) {
                this._speakCurrent();
            }
        } else {
            this._handlePlaylistEnd();
        }
    },

    prev() {
        this.engine.stop();
        if (TTSStateStore.hasPrev()) {
            TTSStateStore.retreat();
            this._activateUI(TTSStateStore.currentIndex);
            
            if (TTSStateStore.isPlaying) {
                this._speakCurrent();
            }
        }
    },

    setAutoNext(enabled) {
        TTSStateStore.setAutoNext(enabled);
    },

    // --- Internal Logic ---

    _activateUI(index) {
        const item = TTSStateStore.playlist[index];
        if (!item) return;

        // 1. Highlight
        this._highlightElement(item.element);
        // 2. Scroll
        Scroller.scrollToId(item.id);
        // 3. Info
        if (this.ui) {
            this.ui.updateInfo(index + 1, TTSStateStore.playlist.length);
        }
    },

    _speakCurrent() {
        const item = TTSStateStore.getCurrentItem();
        if (!item) return;

        // Ensure UI is synced
        this._activateUI(TTSStateStore.currentIndex);

        this.engine.speak(item.text, () => {
            // On End Callback
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
                // 1. Execute External Loader
                await this.onAutoNextRequest();

                // 2. Rescan DOM
                const newItems = TTSDOMParser.parse("sutta-container");
                if (newItems.length > 0) {
                    TTSStateStore.resetPlaylist(newItems);
                    // 3. Continue playing
                    this._speakCurrent();
                } else {
                    this.stop();
                }
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