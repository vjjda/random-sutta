// Path: web/assets/modules/tts/engines/tts_gcloud_engine.js
import { TTSGoogleCloudFetcher } from './support/tts_gcloud_fetcher.js';
import { TTSAudioCache } from './support/tts_audio_cache.js';
import { TTSCloudAudioPlayer } from './support/tts_cloud_audio_player.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_GCloudEngine");

export class TTSGoogleCloudEngine {
    constructor() {
        this.fetcher = new TTSGoogleCloudFetcher(null); // Key set later
        this.cache = new TTSAudioCache();
        this.player = new TTSCloudAudioPlayer();
        
        // Default Config
        this.voice = { name: "en-US-Neural2-D", lang: "en-US" }; // Default high quality voice
        this.rate = 1.0;
        this.apiKey = localStorage.getItem("tts_gcloud_key") || "";
        
        this.fetcher.setApiKey(this.apiKey);
        
        // Callbacks
        this.onVoicesChanged = null; // GCloud voices are static/config based, but we can simulate
    }

    setApiKey(key) {
        this.apiKey = key;
        this.fetcher.setApiKey(key);
        localStorage.setItem("tts_gcloud_key", key);
    }

    getVoices() {
        // Return a static list of popular Google Neural voices for user selection
        // In a full implementation, we could fetch this list from API.
        return [
            { name: "Google US Neural2-A (Male)", voiceURI: "en-US-Neural2-A", lang: "en-US" },
            { name: "Google US Neural2-C (Female)", voiceURI: "en-US-Neural2-C", lang: "en-US" },
            { name: "Google US Neural2-D (Male)", voiceURI: "en-US-Neural2-D", lang: "en-US" },
            { name: "Google US Neural2-F (Female)", voiceURI: "en-US-Neural2-F", lang: "en-US" },
            { name: "Google US Studio-M (Male)", voiceURI: "en-US-Studio-M", lang: "en-US" },
            { name: "Google US Studio-O (Female)", voiceURI: "en-US-Studio-O", lang: "en-US" },
            { name: "Google UK Neural2-B (Male)", voiceURI: "en-GB-Neural2-B", lang: "en-GB" },
            { name: "Google UK Neural2-C (Female)", voiceURI: "en-GB-Neural2-C", lang: "en-GB" }
        ];
    }

    setVoice(voiceURI) {
        const voices = this.getVoices();
        const found = voices.find(v => v.voiceURI === voiceURI);
        if (found) {
            this.voice = { name: found.voiceURI, lang: found.lang };
            localStorage.setItem("tts_gcloud_voice", voiceURI);
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_gcloud_rate", this.rate);
    }
    
    _loadSettings() {
         const savedVoice = localStorage.getItem("tts_gcloud_voice");
         if (savedVoice) this.setVoice(savedVoice);
         
         const savedRate = localStorage.getItem("tts_gcloud_rate");
         if (savedRate) this.rate = parseFloat(savedRate);
    }

    /**
     * Main Speak Function
     */
    async speak(text, onEnd, onBoundary) {
        // 1. Validate
        if (!text || !this.apiKey) {
            logger.warn("Speak", "Missing text or API Key. Falling back to silence/skip.");
            if (onEnd) onEnd();
            return;
        }

        // 2. Generate Key for Cache
        const key = this.cache.generateKey(text, this.voice.name, this.rate);

        try {
            // 3. Check Cache
            let blob = await this.cache.get(key);
            
            if (!blob) {
                // 4. Fetch from Cloud
                logger.info("Speak", "Fetching from Cloud...");
                blob = await this.fetcher.fetchAudio(text, this.voice.lang, this.voice.name, this.rate);
                
                // 5. Save to Cache (Background)
                this.cache.put(key, blob);
            } else {
                logger.info("Speak", "Using Cached Audio");
            }

            // 6. Play
            this.player.play(blob, onEnd);

        } catch (e) {
            logger.error("Speak", "Failed to synthesize", e);
            if (onEnd) onEnd(); // Prevent app hang on error
        }
    }
    
    /**
     * Pre-loads audio for the next text segment
     */
    async prefetch(text) {
        if (!text || !this.apiKey) return;
        
        const key = this.cache.generateKey(text, this.voice.name, this.rate);
        const cached = await this.cache.get(key);
        
        if (!cached) {
            logger.debug("Prefetch", `Downloading: "${text.substring(0, 20)}..."`);
            try {
                const blob = await this.fetcher.fetchAudio(text, this.voice.lang, this.voice.name, this.rate);
                await this.cache.put(key, blob);
            } catch (e) {
                logger.warn("Prefetch", "Failed", e);
            }
        }
    }

    pause() { this.player.pause(); }
    resume() { this.player.resume(); }
    stop() { this.player.stop(); }
}