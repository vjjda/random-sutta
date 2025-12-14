// Path: web/assets/modules/tts/core/tts_session_manager.js
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { TTSMarkerManager } from './tts_marker_manager.js';
import { getLogger } from '../../utils/logger.js';
import { TextSplitter } from '../../utils/text_splitter.js';

const logger = getLogger("TTS_SessionManager");

const SPLIT_THRESHOLD = 450; // Character limit for splitting paragraphs

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

        let originalItems = [];
        if (TTSStateStore.playbackMode === 'paragraph') {
            originalItems = TTSDOMParser.parseParagraphs("sutta-container");
        } else {
            originalItems = TTSDOMParser.parse("sutta-container");
        }
        
        // [NEW] Process items to split long paragraphs
        const processedItems = [];
        originalItems.forEach(item => {
            if (TTSStateStore.playbackMode === 'paragraph' && item.text.length > SPLIT_THRESHOLD) {
                logger.info("Splitting", `Paragraph ${item.id} is too long (${item.text.length} chars), splitting.`);
                const chunks = TextSplitter.split(item.text, { maxLength: SPLIT_THRESHOLD });
                chunks.forEach((chunk, index) => {
                    processedItems.push({
                        ...item, // Inherit element, etc.
                        id: `${item.id}_${index}`, // Create unique sub-ID
                        text: chunk
                    });
                });
            } else {
                processedItems.push(item);
            }
        });

        TTSStateStore.resetPlaylist(processedItems);
        TTSMarkerManager.inject(processedItems); // Inject markers based on new playlist
        
        // [NEW] Check Cache Status (Async)
        if (this.player && this.player.engine) {
            setTimeout(() => {
                TTSMarkerManager.checkCacheStatus(this.player.engine);
            }, 100);
        }
        
        if (processedItems.length > 0) {
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