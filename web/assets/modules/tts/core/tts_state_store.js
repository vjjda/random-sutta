// Path: web/assets/modules/tts/core/tts_state_store.js
export const TTSStateStore = {
    // Runtime State
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    
    // [NEW] Session State: Chỉ True khi người dùng chủ động mở Player
    isSessionActive: false,
    
    // Settings
    autoNextEnabled: true,

    init() {
        this._loadSettings();
    },

    _loadSettings() {
        const savedAutoNext = localStorage.getItem("tts_auto_next");
        if (savedAutoNext !== null) {
            this.autoNextEnabled = (savedAutoNext === "true");
        }
    },

    setAutoNext(enabled) {
        this.autoNextEnabled = enabled;
        localStorage.setItem("tts_auto_next", enabled);
    },

    // [NEW] Session Management
    setSessionActive(active) {
        this.isSessionActive = active;
    },

    resetPlaylist(newPlaylist) {
        this.playlist = newPlaylist;
        this.currentIndex = 0;
    },

    getCurrentItem() {
        if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
            return this.playlist[this.currentIndex];
        }
        return null;
    },

    hasNext() {
        return this.currentIndex < this.playlist.length - 1;
    },

    hasPrev() {
        return this.currentIndex > 0;
    },

    advance() {
        if (this.hasNext()) {
            this.currentIndex++;
            return true;
        }
        return false;
    },

    retreat() {
        if (this.hasPrev()) {
            this.currentIndex--;
            return true;
        }
        return false;
    }
};