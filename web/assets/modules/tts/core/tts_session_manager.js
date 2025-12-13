// Path: web/assets/modules/tts/core/tts_session_manager.js
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_SessionManager");

export const TTSSessionManager = {
    // Dependencies
    player: null,      // Logic Audio
    highlighter: null, // Logic Visuals
    ui: null,          // Logic UI Toggles

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
        this.refresh();
        if (this.ui) this.ui.togglePlayer(true);
    },

    end() {
        logger.info("Lifecycle", "Ending Session.");
        
        // Dừng Player
        if (this.player) this.player.stop();
        
        TTSStateStore.setSessionActive(false); 
        
        // Dọn dẹp UI
        if (this.ui) {
            this.ui.togglePlayer(false); 
            this.ui.closeSettings();
        }
        
        // Xóa Highlight
        if (this.highlighter) this.highlighter.clear();
    },

    refresh(autoPlay = false) {
        if (!TTSStateStore.isSessionActive) return;

        // 1. Reset Player (Stop audio, reset state)
        if (this.player) this.player.stop();

        // 2. Rescan DOM
        const items = TTSDOMParser.parse("sutta-container");
        TTSStateStore.resetPlaylist(items);
        
        // 3. Handle Content
        if (items.length > 0) {
            if (autoPlay) {
                // Auto Play: Player tự lo việc highlight và update UI state
                if (this.player) this.player.play();
            } else {
                // Manual: Chỉ highlight câu đầu, không play
                if (this.highlighter) this.highlighter.activate(0);
            }
        } else {
            // Empty: Clear visuals
            if (this.highlighter) this.highlighter.clear();
            if (this.ui) this.ui.updateInfo(0, 0);
        }
    },

    isActive() {
        return TTSStateStore.isSessionActive;
    }
};