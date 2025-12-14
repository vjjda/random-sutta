// Path: web/assets/modules/tts/engines/support/tts_cloud_audio_player.js
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger("TTS_CloudPlayer");

export class TTSCloudAudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.onEnd = null;
        this.isPlaying = false;

        // Bind events
        this.audio.onended = () => {
            this.isPlaying = false;
            logger.debug("Playback", "Ended");
            if (this.onEnd) this.onEnd();
        };

        this.audio.onerror = (e) => {
            this.isPlaying = false;
            logger.error("Playback", `Error: ${e.message || "Unknown error"}`);
            // Fallback: treat error as end to prevent hanging
            if (this.onEnd) this.onEnd();
        };
    }

    /**
     * Plays an audio blob or URL.
     * @param {Blob|string} source - The audio source.
     * @param {Function} onEndCallback - Called when playback finishes.
     * @param {number} rate - Playback speed (default 1.0).
     */
    play(source, onEndCallback, rate = 1.0) {
        this.stop(); // Stop any previous playback

        this.onEnd = onEndCallback;
        
        let url;
        if (source instanceof Blob) {
            url = URL.createObjectURL(source);
        } else {
            url = source;
        }

        this.audio.src = url;
        this.audio.playbackRate = rate; // [NEW] Set playback rate
        
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                logger.debug("Playback", "Started");
            })
            .catch(err => {
                logger.error("Playback", "Play request failed", err);
                if (this.onEnd) this.onEnd();
            });
    }

    setRate(rate) {
        if (this.audio) {
            this.audio.playbackRate = rate;
        }
    }

    pause() {
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    resume() {
        if (this.audio.src && this.audio.paused) {
            this.audio.play();
            this.isPlaying = true;
        }
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        // Clean up object URL if needed to avoid memory leaks?
        // Browser handles some, but explicit revoke is better if we store the URL.
        // Since we create fresh URL each play, garbage collection handles it eventually,
        // but for long sessions explicit revoke is safer.
        if (this.audio.src.startsWith("blob:")) {
            URL.revokeObjectURL(this.audio.src);
        }
        this.audio.removeAttribute("src");
    }
}