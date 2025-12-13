// Path: web/assets/modules/tts/tts_manager.js
import { WebSpeechEngine } from './engines/web_speech.js';
import { getLogger } from '../utils/logger.js';
import { Scroller } from '../ui/common/scroller.js';

const logger = getLogger("TTSManager");

export const TTSManager = {
    engine: null,
    ui: null, 
    onAutoNext: null, // Callback để load bài mới
    
    // State
    playlist: [], 
    currentIndex: -1,
    isPlaying: false,
    autoNextEnabled: true, // Default true

    init() {
        this.engine = new WebSpeechEngine();
        this._loadSettings();
        logger.info("Init", "TTS Engine Initialized");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
        // Sync UI với State hiện tại
        if (this.ui) this.ui.updateAutoNextState(this.autoNextEnabled);
    },

    setOptions(options) {
        if (options && typeof options.onAutoNext === 'function') {
            this.onAutoNext = options.onAutoNext;
        }
    },

    _loadSettings() {
        const saved = localStorage.getItem("tts_auto_next");
        if (saved !== null) {
            this.autoNextEnabled = (saved === "true");
        }
    },

    setAutoNext(enabled) {
        this.autoNextEnabled = enabled;
        localStorage.setItem("tts_auto_next", enabled);
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
        this.engine.stop();
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this._activateSegment(this.currentIndex);
            if (this.isPlaying) this._speakCurrentSegment();
        } else {
            // Manual Next at end -> Trigger Auto Next logic directly
            this._handlePlaylistEnd();
        }
    },

    prev() {
        this.engine.stop();
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this._activateSegment(this.currentIndex);
            if (this.isPlaying) this._speakCurrentSegment();
        }
    },

    _activateSegment(index) {
        const item = this.playlist[index];
        if (!item) return;
        this._highlightSegment(item);
        Scroller.scrollToId(item.id);
        if (this.ui) this.ui.updateInfo(index + 1, this.playlist.length);
    },

    _speakCurrentSegment() {
        this._activateSegment(this.currentIndex);
        const item = this.playlist[this.currentIndex];
        
        this.engine.speak(item.text, () => {
            if (this.isPlaying) {
                if (this.currentIndex < this.playlist.length - 1) {
                    this.currentIndex++;
                    this._speakCurrentSegment();
                } else {
                    this._handlePlaylistEnd();
                }
            }
        });
    },

    async _handlePlaylistEnd() {
        if (this.autoNextEnabled && this.onAutoNext) {
            logger.info("AutoNext", "Playlist ended. Loading next random sutta...");
            
            if (this.ui) this.ui.updateStatus("Loading next...");
            
            try {
                // 1. Load Sutta mới (Chờ render xong)
                await this.onAutoNext();
                
                // 2. Quét nội dung mới
                if (this.scanContent()) {
                    this.currentIndex = 0;
                    // 3. Tiếp tục phát
                    this._speakCurrentSegment();
                } else {
                    logger.warn("AutoNext", "New sutta has no readable content.");
                    this.stop();
                }
            } catch (e) {
                logger.error("AutoNext", "Failed to load next sutta", e);
                this.stop();
            }
        } else {
            this.stop();
        }
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