// Path: web/assets/modules/tts/engines/gcloud/synthesizer.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("GCloud_Synth");

export class GCloudSynthesizer {
    constructor(fetcher, cache, player, configManager) {
        this.fetcher = fetcher;
        this.cache = cache;
        this.player = player;
        this.config = configManager;
        this.onAudioCached = null;
        
        this.currentReqId = 0;
    }

    async speak(text, onEnd) {
        this.currentReqId++;
        const reqId = this.currentReqId;

        const apiKey = this.config.getApiKey();
        const voice = this.config.getVoice();
        const rate = this.config.getRate();

        // 1. Validation
        if (!apiKey) {
            logger.error("Speak", "API Key missing.");
            throw new Error("API key is missing.");
        }
        if (!text) {
            if (onEnd) onEnd();
            return;
        }
        if (!voice.voiceURI || !voice.voiceURI.includes("-")) {
            logger.error("Speak", `Invalid Voice ID: ${voice.voiceURI}`);
            if (onEnd) onEnd();
            return;
        }

        const key = this.cache.generateKey(text, voice.voiceURI);

        try {
            // 2. Cache Check
            let blob = await this.cache.get(key);
            if (reqId !== this.currentReqId) return;

            // 3. Fetch if miss
            if (!blob) {
                logger.info("Speak", "Fetching...");
                blob = await this.fetcher.fetchAudio(text, voice.lang, voice.voiceURI, 1.0, 0.0);
                
                if (reqId !== this.currentReqId) return;

                // Cache in background
                this.cache.put(key, blob).then(() => {
                    if (this.onAudioCached) this.onAudioCached(text);
                });
            } else {
                logger.info("Speak", "Cache HIT");
            }

            // 4. Play
            this.player.play(blob, onEnd, rate);

        } catch (e) {
            if (reqId !== this.currentReqId) return;
            logger.error("Speak", "Failed", e);
            if (onEnd) onEnd();
        }
    }

    async prefetch(text) {
        const apiKey = this.config.getApiKey();
        const voice = this.config.getVoice();
        
        if (!text || !apiKey) return;

        const key = this.cache.generateKey(text, voice.voiceURI);
        const cached = await this.cache.get(key);

        if (!cached) {
            try {
                const blob = await this.fetcher.fetchAudio(text, voice.lang, voice.voiceURI, 1.0, 0.0);
                await this.cache.put(key, blob);
                if (this.onAudioCached) this.onAudioCached(text);
            } catch (e) {
                logger.warn("Prefetch", "Failed", e);
            }
        }
    }

    cancel() {
        this.currentReqId++;
        this.player.stop();
    }

    /**
     * Checks if audio for the text is already cached.
     * Uses in-memory index for O(1) performance.
     */
    isCached(text) {
        const voice = this.config.getVoice();
        if (!text || !voice || !voice.voiceURI) return Promise.resolve(false);

        const key = this.cache.generateKey(text, voice.voiceURI);
        // hasKey is synchronous, but we return Promise to match async interface
        return Promise.resolve(this.cache.hasKey(key));
    }
}