// Path: web/assets/modules/tts/tts_manager.js
import { WebSpeechEngine } from './engines/web_speech.js';
import { getLogger } from '../utils/logger.js';
import { Scroller } from '../ui/common/scroller.js';

const logger = getLogger("TTSManager");

export const TTSManager = {
    engine: null,
    ui: null, 
    
    // State
    playlist: [], 
    currentIndex: -1,
    isPlaying: false,

    init() {
        this.engine = new WebSpeechEngine();
        logger.info("Init", "TTS Engine Initialized");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
    },

    scanContent() {
        const container = document.getElementById("sutta-container");
        if (!container) return false;

        const segments = Array.from(container.querySelectorAll(".segment"));
        
        this.playlist = segments
            .filter(seg => seg.offsetParent !== null)
            .map(seg => {
                const engEl = seg.querySelector(".eng");
                if (!engEl) return null;
                
                let text = engEl.textContent.trim();
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
            // [UX] Khi mới mở lên, highlight luôn đoạn đầu tiên
            this._activateSegment(0); 
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
        if (this.ui) this.ui.updatePlayState(true);
        this._speakCurrentSegment();
    },

    _pause() {
        this.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);
        this.engine.pause(); 
    },

    stop() {
        this.isPlaying = false;
        if (this.ui) this.ui.updatePlayState(false);
        this.engine.stop();
        this._clearHighlight();
    },

    next() {
        // [LOGIC FIX] Stop engine cũ nhưng KHÔNG đổi trạng thái isPlaying (nếu đang play thì vẫn play tiếp đoạn sau)
        this.engine.stop();
        
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            // [UX] Update UI ngay lập tức
            this._activateSegment(this.currentIndex);
            
            // Nếu đang play thì đọc tiếp, nếu đang pause thì chỉ chuyển highlight thôi
            if (this.isPlaying) {
                this._speakCurrentSegment();
            }
        }
    },

    prev() {
        this.engine.stop();
        if (this.currentIndex > 0) {
            this.currentIndex--;
            // [UX] Update UI ngay lập tức
            this._activateSegment(this.currentIndex);

            if (this.isPlaying) {
                this._speakCurrentSegment();
            }
        }
    },

    // Hàm chuyên trách cập nhật UI (Visual State)
    _activateSegment(index) {
        const item = this.playlist[index];
        if (!item) return;

        // 1. Highlight
        this._highlightSegment(item);
        
        // 2. Scroll
        Scroller.scrollToId(item.id);

        // 3. Update Info Text
        if (this.ui) {
            this.ui.updateInfo(index + 1, this.playlist.length);
        }
    },

    // Hàm chuyên trách phát âm thanh (Audio State)
    _speakCurrentSegment() {
        // Luôn chắc chắn UI đúng với Audio
        this._activateSegment(this.currentIndex);

        const item = this.playlist[this.currentIndex];
        
        this.engine.speak(item.text, () => {
            // On End (Audio finished)
            if (this.isPlaying) {
                if (this.currentIndex < this.playlist.length - 1) {
                    this.currentIndex++;
                    this._speakCurrentSegment();
                } else {
                    this.stop(); 
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