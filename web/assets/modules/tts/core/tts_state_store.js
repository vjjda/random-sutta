// Path: web/assets/modules/tts/core/tts_state_store.js
export const TTSStateStore = {
    // ... (Giữ nguyên state runtime) ...
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    isSessionActive: false,
    
    // Settings Defaults
    autoNextEnabled: true,
    playbackMode: 'paragraph',
    activeEngine: 'wsa',

    init() {
        this._loadSettings();
    },

    _loadSettings() {
        const savedAutoNext = localStorage.getItem("tts_auto_next");
        if (savedAutoNext !== null) {
            this.autoNextEnabled = (savedAutoNext === "true");
        }
        
        const savedMode = localStorage.getItem("tts_playback_mode");
        if (savedMode) {
            this.playbackMode = savedMode;
        }

        const savedEngine = localStorage.getItem("tts_active_engine");
        if (savedEngine) {
            this.activeEngine = savedEngine;
        }
        
        console.log("StateStore: Loaded settings", {
            autoNext: this.autoNextEnabled,
            mode: this.playbackMode,
            engine: this.activeEngine
        });
    },

    setAutoNext(enabled) {
        this.autoNextEnabled = enabled;
        localStorage.setItem("tts_auto_next", enabled);
        console.log("StateStore: Saved AutoNext ->", enabled); // LOG
    },
    
    setPlaybackMode(mode) {
        this.playbackMode = mode;
        localStorage.setItem("tts_playback_mode", mode);
        console.log("StateStore: Saved Mode ->", mode); // LOG
    },

    setActiveEngine(engineId) {
        this.activeEngine = engineId;
        localStorage.setItem("tts_active_engine", engineId);
        console.log("StateStore: Saved Engine ->", engineId); // LOG
    },

    // ... (Giữ nguyên phần Session & Playlist logic) ...
    setSessionActive(active) { this.isSessionActive = active; },
    resetPlaylist(newPlaylist) { this.playlist = newPlaylist; this.currentIndex = 0; },
    getCurrentItem() { return (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) ? this.playlist[this.currentIndex] : null; },
    getNextItem() { const nextIndex = this.currentIndex + 1; return (nextIndex < this.playlist.length) ? this.playlist[nextIndex] : null; },
    hasNext() { return this.currentIndex < this.playlist.length - 1; },
    hasPrev() { return this.currentIndex > 0; },
    advance() { if (this.hasNext()) { this.currentIndex++; return true; } return false; },
    retreat() { if (this.hasPrev()) { this.currentIndex--; return true; } return false; }
};