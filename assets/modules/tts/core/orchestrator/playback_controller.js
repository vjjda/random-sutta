// Path: web/assets/modules/tts/core/orchestrator/playback_controller.js
import { TTSStateStore } from 'tts/core/tts_state_store.js';
import { TTSSessionManager } from 'tts/core/tts_session_manager.js';
import { TTSPlayer } from 'tts/core/tts_player.js';
import { getLogger } from 'utils/logger.js'; // [FUTURE PROOF]

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

    togglePlay() {
        if (!TTSSessionManager.isActive()) {
            TTSSessionManager.start();
            this.uiSync.refreshOfflineVoicesStatus();
        }
        
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

    setPlaybackMode(mode) {
        if (TTSStateStore.playbackMode === mode) return;
        
        TTSStateStore.setPlaybackMode(mode);

        if (!TTSSessionManager.isActive()) return;

        const currentItem = TTSStateStore.getCurrentItem();
        let targetId = currentItem ? currentItem.id : null;

        TTSSessionManager.refresh(false);

        if (targetId) {
            this.jumpToID(targetId);
            
            if (TTSStateStore.playbackMode === 'paragraph') {
                const foundIndex = TTSStateStore.playlist.findIndex(block => {
                    return block.segments && block.segments.some(s => s.id === targetId);
                });
                if (foundIndex !== -1) TTSPlayer.jumpTo(foundIndex);
            }
        }
    }

    async handlePlaylistEnd() {
        if (TTSStateStore.autoNextEnabled && this.onAutoNextRequest) {
            logger.info("AutoNext", "Playlist ended. Requesting next...");
            this.uiSync.updateStatus("Loading next...");

            try {
                await this.onAutoNextRequest();
                TTSPlayer.stop();
            } catch (e) {
                logger.error("AutoNext", "Failed", e);
                TTSPlayer.stop();
            }
        } else {
            TTSPlayer.stop();
        }
    }
}