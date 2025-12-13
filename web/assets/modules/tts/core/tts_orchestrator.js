// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSWebSpeechEngine } from '../engines/tts_web_speech_engine.js';
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
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
        logger.info("Init", "Orchestrator Ready");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
        if (this.ui) {
            this.ui.updateAutoNextState(TTSStateStore.autoNextEnabled);
        }
    },

    setCallbacks(callbacks) {
        if (callbacks && typeof callbacks.onAutoNext === 'function') {
            this.onAutoNextRequest = callbacks.onAutoNext;
        }
    },

    // --- Session Management [NEW] ---

    // Gọi khi click Magic Corner hoặc Double Tap Nav
    startSession() {
        if (TTSStateStore.isSessionActive) {
            // Nếu đang active mà gọi lại (vd click corner) -> Chỉ hiện UI lên nếu đang ẩn
            if (this.ui) this.ui.togglePlayer(true);
            return;
        }

        logger.info("Session", "Starting TTS Session...");
        TTSStateStore.setSessionActive(true);
        
        // Scan ngay khi start session
        const items = TTSDOMParser.parse("sutta-container");
        if (items.length > 0) {
            TTSStateStore.resetPlaylist(items);
            this._activateUI(0);
        }
        
        // Hiện Player
        if (this.ui) this.ui.togglePlayer(true);
    },

    // Gọi khi click nút Close (X)
    endSession() {
        logger.info("Session", "Ending TTS Session.");
        this.stop(); // Dừng đọc
        TTSStateStore.setSessionActive(false); // Reset cờ
        
        if (this.ui) {
            this.ui.togglePlayer(false); // Ẩn UI
            this.ui.closeSettings();
        }
        this._clearHighlight();
    },

    isSessionActive() {
        return TTSStateStore.isSessionActive;
    },

    // --- Actions ---

    togglePlay() {
        // [Safety] Nếu toggle play mà session chưa active thì kích hoạt luôn
        if (!TTSStateStore.isSessionActive) {
            this.startSession();
        }

        if (TTSStateStore.playlist.length === 0) {
            const items = TTSDOMParser.parse("sutta-container");
            if (items.length === 0) return;
            TTSStateStore.resetPlaylist(items);
            this._activateUI(0); 
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
        // Không clear highlight ở đây để giữ vị trí đọc, chỉ clear khi endSession
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

    // Nhảy đến một ID cụ thể (Segment Trigger)
    jumpToID(id) {
        // [CRITICAL] Chỉ nhảy nếu Session đang Active
        if (!TTSStateStore.isSessionActive) {
            return;
        }

        // 1. Nếu playlist trống, scan trước
        if (TTSStateStore.playlist.length === 0) {
            const items = TTSDOMParser.parse("sutta-container");
            TTSStateStore.resetPlaylist(items);
        }

        // 2. Tìm index
        const index = TTSStateStore.playlist.findIndex(item => item.id === id);
        if (index !== -1) {
            this.engine.stop(); // Dừng câu đang đọc
            
            TTSStateStore.currentIndex = index;
            this._activateUI(index);

            // Nếu đang chưa play thì play luôn
            if (!TTSStateStore.isPlaying) {
                this.play();
            } else {
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

        this._highlightElement(item.element);
        
        // Sử dụng scroll mode đọc sách
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
                const newItems = TTSDOMParser.parse("sutta-container");
                if (newItems.length > 0) {
                    TTSStateStore.resetPlaylist(newItems);
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