// Path: web/assets/modules/tts/core/tts_player.js
import { TTSStateStore } from './tts_state_store.js';
import { AppConfig } from '../../core/app_config.js'; // [NEW] Import

export const TTSPlayer = {
    engine: null,
    highlighter: null,
    ui: null,
    onPlaylistEnd: null, // Callback khi đọc hết bài
    farthestPrefetchedIndex: -1,

    init(engine, highlighter, ui) {
        this.engine = engine;
        this.highlighter = highlighter;
        this.ui = ui;
    },

    reset() {
        this.farthestPrefetchedIndex = -1;
    },

    setCallbacks(onPlaylistEnd) {
        this.onPlaylistEnd = onPlaylistEnd;
    },

    // --- Core Operations ---

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
        // Player stop không có trách nhiệm clear highlight (để giữ vị trí đọc)
    },

    next() {
        this.engine.stop();
        if (TTSStateStore.hasNext()) {
            TTSStateStore.advance();
            this._activateAndPlayIfRunning();
        } else {
            this._triggerEnd();
        }
    },

    prev() {
        this.engine.stop();
        if (TTSStateStore.hasPrev()) {
            TTSStateStore.retreat();
            this._activateAndPlayIfRunning();
        }
    },

    jumpTo(index) {
        if (index < 0 || index >= TTSStateStore.playlist.length) return;
        
        this.engine.stop();
        TTSStateStore.currentIndex = index;
        
        // Highlight ngay lập tức
        this.highlighter.activate(index);

        // Nếu đang play thì đọc luôn, không thì thôi
        if (TTSStateStore.isPlaying) {
            this._speakCurrent();
        }
    },

    // --- Helpers ---

    _activateAndPlayIfRunning() {
        const idx = TTSStateStore.currentIndex;
        this.highlighter.activate(idx);
        if (TTSStateStore.isPlaying) {
            this._speakCurrent();
        }
    },

    _speakCurrent() {
        const item = TTSStateStore.getCurrentItem();
        if (!item) return;

        // Đảm bảo highlight đúng câu đang đọc
        this.highlighter.activate(TTSStateStore.currentIndex);
        
        // [NEW] Rolling Buffer Logic
        this._managePrefetchBuffer();

        this.engine.speak(item.text, () => {
            // Callback khi đọc xong 1 câu
            if (TTSStateStore.isPlaying) {
                if (TTSStateStore.hasNext()) {
                    TTSStateStore.advance();
                    this._speakCurrent(); // Đệ quy đọc câu tiếp
                } else {
                    this._triggerEnd();
                }
            }
        }).catch(e => {
            console.error("TTS Player Error:", e);
            this.stop(); // Stop playback on hard error
            if (this.ui && this.ui.showError) {
                this.ui.showError(e.message);
            }
        });
    },

    _managePrefetchBuffer() {
        if (!this.engine.prefetch) return;

        const { currentIndex, playlist } = TTSStateStore;
        const bufferSize = AppConfig.TTS?.BUFFER_AHEAD || 7;

        // The index of the farthest item we want to have in our buffer
        const desiredFarthestIndex = Math.min(currentIndex + bufferSize, playlist.length - 1);

        // If we've already queued everything up to this point, no need to do more.
        if (this.farthestPrefetchedIndex >= desiredFarthestIndex) {
            return;
        }

        // Fetch the items from our last known point to the new desired point.
        const startIndex = this.farthestPrefetchedIndex + 1;
        for (let i = startIndex; i <= desiredFarthestIndex; i++) {
            const item = playlist[i];
            if (item) {
                this.engine.prefetch(item.text);
            }
        }
        
        // Update the high-water mark
        this.farthestPrefetchedIndex = desiredFarthestIndex;
    },

    _triggerEnd() {
        if (this.onPlaylistEnd) this.onPlaylistEnd();
        else this.stop();
    }
};