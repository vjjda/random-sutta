// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSWebSpeechEngine } from '../engines/tts_web_speech_engine.js';
import { TTSStateStore } from './tts_state_store.js';
import { TTSPlayer } from './tts_player.js';           // [NEW]
import { TTSHighlighter } from './tts_highlighter.js'; // [NEW]
import { TTSSessionManager } from './tts_session_manager.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    engine: null,
    ui: null, 
    onAutoNextRequest: null,

    init() {
        this.engine = new TTSWebSpeechEngine();
        TTSStateStore.init();
        
        // 1. Init Modules
        // Highlighter cần UI (sẽ set sau khi UI init)
        
        // Player cần Engine, Highlighter, UI
        TTSPlayer.init(this.engine, TTSHighlighter, null);
        
        // SessionManager cần Player, Highlighter, UI
        TTSSessionManager.init(TTSPlayer, TTSHighlighter, null);

        // Setup Callback khi Player đọc xong bài
        TTSPlayer.setCallbacks(() => this._handlePlaylistEnd());

        logger.info("Init", "Orchestrator Ready (Refactored)");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
        
        // Inject UI vào các sub-modules
        TTSHighlighter.setUI(uiInstance);
        TTSPlayer.ui = uiInstance;
        TTSSessionManager.ui = uiInstance;

        // Sync UI state ban đầu
        if (this.ui) {
            this.ui.updateAutoNextState(TTSStateStore.autoNextEnabled);
        }
    },

    setCallbacks(callbacks) {
        if (callbacks && typeof callbacks.onAutoNext === 'function') {
            this.onAutoNextRequest = callbacks.onAutoNext;
        }
    },

    // --- Public Facade (Clean API) ---

    startSession() { TTSSessionManager.start(); },
    endSession() { TTSSessionManager.end(); },
    refreshSession(autoPlay) { TTSSessionManager.refresh(autoPlay); },
    
    isSessionActive() { return TTSSessionManager.isActive(); },
    isPlaying() { return TTSStateStore.isPlaying; },

    // --- Controls ---

    togglePlay() {
        if (!TTSSessionManager.isActive()) {
            this.startSession();
        }
        // Defensive: Check playlist empty
        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
            if (TTSStateStore.playlist.length === 0) return;
        }

        if (TTSStateStore.isPlaying) TTSPlayer.pause();
        else TTSPlayer.play();
    },

    play() { TTSPlayer.play(); },
    pause() { TTSPlayer.pause(); },
    stop() { TTSPlayer.stop(); },
    next() { TTSPlayer.next(); },
    prev() { TTSPlayer.prev(); },

    jumpToID(id) {
        if (!TTSSessionManager.isActive()) return;

        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
        }

        const index = TTSStateStore.playlist.findIndex(item => item.id === id);
        if (index !== -1) {
            TTSPlayer.jumpTo(index);
        }
    },

    setAutoNext(enabled) {
        TTSStateStore.setAutoNext(enabled);
    },

    // --- Business Logic: Playlist End Strategy ---

    async _handlePlaylistEnd() {
        // Orchestrator quyết định làm gì khi hết bài (đây là Business Logic, không phải Player Logic)
        if (TTSStateStore.autoNextEnabled && this.onAutoNextRequest) {
            logger.info("AutoNext", "Playlist ended. Requesting next...");
            if (this.ui) this.ui.updateStatus("Loading next...");

            try {
                // Gọi callback ra ngoài (SuttaController sẽ load bài mới)
                // SuttaController load xong sẽ gọi lại refreshSession(true)
                await this.onAutoNextRequest();
                
                // Stop tạm thời để an toàn, chờ lệnh refresh từ Controller
                TTSPlayer.stop(); 
            } catch (e) {
                logger.error("AutoNext", "Failed", e);
                TTSPlayer.stop();
            }
        } else {
            TTSPlayer.stop();
        }
    }
};