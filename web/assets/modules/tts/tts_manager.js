// Path: web/assets/modules/tts/tts_manager.js
import { WebSpeechEngine } from './engines/web_speech.js';
import { getLogger } from '../utils/logger.js'; // [FIXED] Correct path
import { Scroller } from '../ui/common/scroller.js';

const logger = getLogger("TTSManager");

export const TTSManager = {
    engine: null,
    ui: null, // Sẽ được inject từ index
    
    // State
    playlist: [], // Array of { id, text, element }
    currentIndex: -1,
    isPlaying: false,

    init(uiInstance) {
        this.ui = uiInstance;
        this.engine = new WebSpeechEngine();
    },

    // Quét toàn bộ nội dung bài kinh để tạo playlist
    scanContent() {
        const container = document.getElementById("sutta-container");
        if (!container) return false;

        // Chỉ lấy các segment có chứa tiếng Anh (.eng)
        const segments = Array.from(container.querySelectorAll(".segment"));
        
        this.playlist = segments
            .map(seg => {
                const engEl = seg.querySelector(".eng");
                if (!engEl) return null;
                
                // [TODO]: Normalize Pali here later (e.g., remove special chars)
                let text = engEl.textContent.trim();
                
                // Clean citation references like [1] if any
                text = text.replace(/\[\d+\]/g, "");

                return {
                    id: seg.id,
                    text: text,
                    element: seg
                };
            })
            .filter(item => item !== null && item.text.length > 0);

        logger.info("Scan", `Found ${this.playlist.length} readable segments.`);
        return this.playlist.length > 0;
    },

    togglePlay() {
        if (this.playlist.length === 0) {
            if (!this.scanContent()) return;
            this.currentIndex = 0;
        }

        if (this.isPlaying) {
            this._pause();
        } else {
            this._play();
        }
    },

    _play() {
        if (this.currentIndex >= this.playlist.length) {
            this.currentIndex = 0;
        }

        this.isPlaying = true;
        this.ui.updatePlayState(true);
        this._speakCurrentSegment();
    },

    _pause() {
        this.isPlaying = false;
        this.ui.updatePlayState(false);
        this.engine.pause(); // Native pause
    },

    stop() {
        this.isPlaying = false;
        this.ui.updatePlayState(false);
        this.engine.stop();
        this._clearHighlight();
    },

    next() {
        this.engine.stop();
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this._speakCurrentSegment();
        }
    },

    prev() {
        this.engine.stop();
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this._speakCurrentSegment();
        }
    },

    _speakCurrentSegment() {
        if (!this.isPlaying) return;

        const item = this.playlist[this.currentIndex];
        
        // 1. Highlight UI
        this._highlightSegment(item);
        
        // 2. Scroll to View
        Scroller.scrollToId(item.id);

        // 3. Update UI Info
        this.ui.updateInfo(this.currentIndex + 1, this.playlist.length);

        // 4. Speak
        this.engine.speak(item.text, () => {
            // On End
            if (this.isPlaying) {
                if (this.currentIndex < this.playlist.length - 1) {
                    this.currentIndex++;
                    this._speakCurrentSegment();
                } else {
                    this.stop(); // End of playlist
                }
            }
        });
    },

    _highlightSegment(item) {
        this._clearHighlight();
        if (item && item.element) {
            item.element.classList.add("tts-active");
        }
    },

    _clearHighlight() {
        document.querySelectorAll(".tts-active").forEach(el => el.classList.remove("tts-active"));
    }
};