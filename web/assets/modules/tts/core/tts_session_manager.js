// Path: web/assets/modules/tts/core/tts_session_manager.js
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { TTSMarkerManager } from './tts_marker_manager.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_SessionManager");

export const TTSSessionManager = {
    // Dependencies
    player: null,
    highlighter: null,
    ui: null,

    init(player, highlighter, ui) {
        this.player = player;
        this.highlighter = highlighter;
        this.ui = ui;
    },

    start() {
        if (TTSStateStore.isSessionActive) {
            if (this.ui) this.ui.togglePlayer(true);
            return;
        }

        logger.info("Lifecycle", "Starting Session...");
        TTSStateStore.setSessionActive(true);
        
        // [NEW] Thêm class vào body để CSS đẩy padding lên
        document.body.classList.add('tts-open');

        this.refresh();
        if (this.ui) this.ui.togglePlayer(true);
    },

    end() {
        logger.info("Lifecycle", "Ending Session.");
        
        if (this.player) this.player.stop();
        
        TTSStateStore.setSessionActive(false); 
        
        // [NEW] Xóa class khỏi body -> Padding trở về bình thường
        document.body.classList.remove('tts-open');
        
        if (this.ui) {
            this.ui.togglePlayer(false); 
            this.ui.closeSettings();
        }
        
        if (this.highlighter) this.highlighter.clear();
        TTSMarkerManager.remove();
    },

    refresh(autoPlay = false) {
        if (!TTSStateStore.isSessionActive) return;

        if (this.player) this.player.stop();

        let items = [];
        if (TTSStateStore.playbackMode === 'paragraph') {
            items = TTSDOMParser.parseParagraphs("sutta-container");
        } else {
            items = TTSDOMParser.parse("sutta-container");
        }
        
        TTSStateStore.resetPlaylist(items);
        TTSMarkerManager.inject(items); // [NEW] Inject markers based on new playlist
        
        if (items.length > 0) {
            if (autoPlay) {
                if (this.player) this.player.play();
            } else {
                if (this.highlighter) this.highlighter.activate(0);
            }
        } else {
            if (this.highlighter) this.highlighter.clear();
            if (this.ui) this.ui.updateInfo(0, 0);
        }
    },

    isActive() {
        return TTSStateStore.isSessionActive;
    }
};