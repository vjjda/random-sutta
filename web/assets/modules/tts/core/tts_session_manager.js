// Path: web/assets/modules/tts/core/tts_session_manager.js
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_SessionManager");

export const TTSSessionManager = {
    // Dependencies (Inject from Orchestrator)
    engine: null,
    ui: null,
    highlightHelpers: null, // { activateUI, clearHighlight }

    init(engine, ui, highlightHelpers) {
        this.engine = engine;
        this.ui = ui;
        this.highlightHelpers = highlightHelpers;
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
        if (this.engine) this.engine.stop();
        
        TTSStateStore.setSessionActive(false); 
        TTSStateStore.isPlaying = false; // Reset playing state
        
        if (this.ui) {
            this.ui.togglePlayer(false); 
            this.ui.closeSettings();
            this.ui.updatePlayState(false);
        }
        
        if (this.highlightHelpers) this.highlightHelpers.clearHighlight();
    },

    refresh(autoPlay = false) {
        if (!TTSStateStore.isSessionActive) return;

        // 1. Stop current audio
        if (this.engine) this.engine.stop();
        
        // 2. Reset Play State temporarily
        TTSStateStore.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);

        // 3. Rescan DOM
        const items = TTSDOMParser.parse("sutta-container");
        TTSStateStore.resetPlaylist(items);
        
        // 4. Handle Content
        if (items.length > 0) {
            if (autoPlay) {
                // Play logic will be triggered by Orchestrator or we call it via helper
                // Để tránh circular dependency phức tạp, ta set state và gọi callback
                TTSStateStore.isPlaying = true;
                if (this.ui) this.ui.updatePlayState(true);
                // Orchestrator need to know to speak. 
                // However, for simplicity, we assume Orchestrator exposes a public play() 
                // or we use the highlightHelper to at least set UI.
                
                // Vì speak() nằm ở Orchestrator, ở đây ta sẽ trả về tín hiệu
                // hoặc gọi highlight trước.
                if (this.highlightHelpers && this.highlightHelpers.play) {
                    this.highlightHelpers.play();
                }
            } else {
                if (this.highlightHelpers) this.highlightHelpers.activateUI(0);
            }
        } else {
            if (this.highlightHelpers) this.highlightHelpers.clearHighlight();
            if (this.ui) this.ui.updateInfo(0, 0);
        }
    },

    isActive() {
        return TTSStateStore.isSessionActive;
    }
};