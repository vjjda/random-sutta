// Path: web/assets/modules/tts/core/orchestrator/playback_controller.js
import { TTSStateStore } from '../tts_state_store.js';
import { TTSSessionManager } from '../tts_session_manager.js';
import { TTSPlayer } from '../tts_player.js';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger("TTS_PlaybackCtrl");

export class TTSPlaybackController {
    constructor(uiSync) {
        this.uiSync = uiSync;
        this.onAutoNextRequest = null;
    }

    setCallbacks(callbacks) {
        if (callbacks && typeof callbacks.onAutoNext === 'function') {
            this.onAutoNextRequest = callbacks.onAutoNext;
        }
    }

    // --- Core Logic ---

    togglePlay() {
        if (!TTSSessionManager.isActive()) {
            // Start session (UI opens, etc.)
            TTSSessionManager.start();
            this.uiSync.refreshOfflineVoicesStatus();
        }
        
        // Defensive: Playlist check
        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
            if (TTSStateStore.playlist.length === 0) return;
        }

        if (TTSStateStore.isPlaying) TTSPlayer.pause();
        else TTSPlayer.play();
    }

    stop() { TTSPlayer.stop(); }
    pause() { TTSPlayer.pause(); }
    play() { TTSPlayer.play(); }
    next() { TTSPlayer.next(); }
    prev() { TTSPlayer.prev(); }

    jumpToID(id) {
        if (!TTSSessionManager.isActive()) return;
        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
        }

        const index = TTSStateStore.playlist.findIndex(item => item.id === id);
        if (index !== -1) {
            TTSPlayer.jumpTo(index);
        }
    }

    // --- Mode Switching Logic ---

    setPlaybackMode(mode) {
        if (TTSStateStore.playbackMode === mode) return;
        
        TTSStateStore.setPlaybackMode(mode);

        if (!TTSSessionManager.isActive()) return;

        // Capture current ID to try and restore position
        const currentItem = TTSStateStore.getCurrentItem();
        let targetId = currentItem ? currentItem.id : null;

        // Refresh playlist structure (Segments <-> Paragraphs)
        TTSSessionManager.refresh(false);

        // Smart Jump
        if (targetId) {
            // Try direct jump
            this.jumpToID(targetId);
            
            // If failed (e.g. switching Paragraph -> Segment mid-paragraph), try smart lookup
            if (TTSStateStore.playbackMode === 'paragraph') {
                const foundIndex = TTSStateStore.playlist.findIndex(block => {
                    return block.segments && block.segments.some(s => s.id === targetId);
                });
                if (foundIndex !== -1) TTSPlayer.jumpTo(foundIndex);
            }
        }
    }

    // --- Playlist End Strategy ---

    async handlePlaylistEnd() {
        if (TTSStateStore.autoNextEnabled && this.onAutoNextRequest) {
            logger.info("AutoNext", "Playlist ended. Requesting next...");
            this.uiSync.updateStatus("Loading next...");

            try {
                // Call external handler (SuttaController)
                await this.onAutoNextRequest();
                TTSPlayer.stop(); // Safe stop
            } catch (e) {
                logger.error("AutoNext", "Failed", e);
                TTSPlayer.stop();
            }
        } else {
            TTSPlayer.stop();
        }
    }
}