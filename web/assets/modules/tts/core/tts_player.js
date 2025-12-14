// Path: web/assets/modules/tts/core/tts_player.js
import { TTSStateStore } from './tts_state_store.js';

export const TTSPlayer = {
    engine: null,
    highlighter: null,
    ui: null,
    onPlaylistEnd: null, // Callback khi đọc hết bài

    init(engine, highlighter, ui) {
        this.engine = engine;
        this.highlighter = highlighter;
        this.ui = ui;
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
        
        // [NEW] Prefetch next item if engine supports it
        if (this.engine.prefetch && TTSStateStore.hasNext()) {
            const nextItem = TTSStateStore.playlist[TTSStateStore.currentIndex + 1];
            if (nextItem) {
                this.engine.prefetch(nextItem.text);
            }
        }

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
        });
    },

    _triggerEnd() {
        if (this.onPlaylistEnd) this.onPlaylistEnd();
        else this.stop();
    }
};