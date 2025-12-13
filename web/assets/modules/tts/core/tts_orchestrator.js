// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSWebSpeechEngine } from '../engines/tts_web_speech_engine.js';
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { getLogger } from '../../utils/logger.js';
import { Scroller } from '../../ui/common/scroller.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    // ... (Giữ nguyên phần init, setUI, setCallbacks) ...
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

    // --- Session Management ---

    startSession() {
        if (TTSStateStore.isSessionActive) {
            if (this.ui) this.ui.togglePlayer(true);
            return;
        }

        logger.info("Session", "Starting TTS Session...");
        TTSStateStore.setSessionActive(true);
        
        this.refreshSession();
        
        if (this.ui) this.ui.togglePlayer(true);
    },

    endSession() {
        logger.info("Session", "Ending TTS Session.");
        this.stop(); 
        TTSStateStore.setSessionActive(false); 
        
        if (this.ui) {
            this.ui.togglePlayer(false); 
            this.ui.closeSettings();
        }
        this._clearHighlight();
    },

    // [UPDATED] Thêm tham số autoPlay
    refreshSession(autoPlay = false) {
        if (!TTSStateStore.isSessionActive) return;

        // 1. Dừng đọc bài cũ (bắt buộc để không bị tiếng chồng lấn)
        this.engine.stop();
        
        // 2. Scan DOM mới
        const items = TTSDOMParser.parse("sutta-container");
        
        // 3. Reset Playlist (về index 0)
        TTSStateStore.resetPlaylist(items);
        
        if (items.length > 0) {
            // [LOGIC MỚI] Nếu bài trước đang play -> Bài này play luôn
            if (autoPlay) {
                this.play(); // Hàm này sẽ tự update UI play state và highlight
            } else {
                // Nếu không thì chỉ highlight câu đầu chờ người dùng bấm
                TTSStateStore.isPlaying = false;
                if (this.ui) this.ui.updatePlayState(false);
                this._activateUI(0);
            }
        } else {
            this._clearHighlight();
            TTSStateStore.isPlaying = false;
            if (this.ui) {
                this.ui.updatePlayState(false);
                this.ui.updateInfo(0, 0);
            }
        }
    },

    isSessionActive() {
        return TTSStateStore.isSessionActive;
    },

    // [NEW] Helper để Controller check trạng thái
    isPlaying() {
        return TTSStateStore.isPlaying;
    },

    // --- Actions (Giữ nguyên) ---

    togglePlay() {
        if (!TTSStateStore.isSessionActive) {
            this.startSession();
        }

        if (TTSStateStore.playlist.length === 0) {
            this.refreshSession();
            if (TTSStateStore.playlist.length === 0) return;
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
        if (!TTSStateStore.isSessionActive) return;

        if (TTSStateStore.playlist.length === 0) {
            this.refreshSession();
        }

        const index = TTSStateStore.playlist.findIndex(item => item.id === id);
        if (index !== -1) {
            this.engine.stop(); 
            
            TTSStateStore.currentIndex = index;
            this._activateUI(index);

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

    // --- Internal Logic (Giữ nguyên) ---

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