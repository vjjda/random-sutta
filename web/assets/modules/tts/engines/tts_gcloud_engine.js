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
        this.pitch = 0.0;
        this.apiKey = localStorage.getItem("tts_gcloud_key") || "";
        
        this.fetcher.setApiKey(this.apiKey);
        this.availableVoices = []; // [NEW] Dynamic list
        this._loadSettings();
        
        // Try loading cached voices first
        const cachedVoices = localStorage.getItem("tts_gcloud_voices_list");
        if (cachedVoices) {
            try {
                this.availableVoices = JSON.parse(cachedVoices);
            } catch(e) { /* ignore */ }
        }

        // Callbacks
        this.onVoicesChanged = null;
        this.onAudioCached = null; // [NEW] Callback for smart marker update
        
        // Race Condition Handling
        this.currentReqId = 0;
    }

    setApiKey(key) {
        this.apiKey = key;
        this.fetcher.setApiKey(key);
        localStorage.setItem("tts_gcloud_key", key);
        
        // Auto fetch voices if key is present
        if (key) {
            this.refreshVoices();
        }
    }
    
    async refreshVoices() {
        if (!this.apiKey) return;
        try {
            const rawVoices = await this.fetcher.fetchVoices();
            // Filter and Map
            this.availableVoices = rawVoices
                .filter(v => v.languageCodes.includes("en-US") || v.languageCodes.includes("en-GB"))
                .map(v => ({
                    name: `${v.name} (${v.ssmlGender})`,
                    voiceURI: v.name,
                    lang: v.languageCodes[0]
                }));
            
            // Sort by name
            this.availableVoices.sort((a, b) => a.name.localeCompare(b.name));

            localStorage.setItem("tts_gcloud_voices_list", JSON.stringify(this.availableVoices));
            
            if (this.onVoicesChanged) {
                this.onVoicesChanged(this.availableVoices);
            }
            logger.info("Voices", `Loaded ${this.availableVoices.length} voices from GCloud.`);
        } catch (e) {
            logger.warn("Voices", "Failed to refresh voices", e);
        }
    }

    getVoices() {
        if (this.availableVoices.length > 0) {
            return this.availableVoices;
        }
        // Fallback static list
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
        } else if (voiceURI) {
            // [Fix] Allow setting saved voice even if list not fully loaded yet
            // Assume it's a valid Google Voice URI
            this.voice = { name: voiceURI, lang: "en-US" }; // Default lang assumption or extract from ID
            localStorage.setItem("tts_gcloud_voice", voiceURI);
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_gcloud_rate", this.rate);
    }

    setPitch(pitch) {
        this.pitch = parseFloat(pitch);
        localStorage.setItem("tts_gcloud_pitch", this.pitch);
    }
    
    _loadSettings() {
         const savedVoice = localStorage.getItem("tts_gcloud_voice");
         if (savedVoice) this.setVoice(savedVoice);
         
         const savedRate = localStorage.getItem("tts_gcloud_rate");
         if (savedRate) this.rate = parseFloat(savedRate);

         const savedPitch = localStorage.getItem("tts_gcloud_pitch");
         if (savedPitch) this.pitch = parseFloat(savedPitch);
    }

    /**
     * Main Speak Function
     */
    async speak(text, onEnd, onBoundary) {
        // Increment Request ID
        this.currentReqId++;
        const reqId = this.currentReqId;

        // 1. Validate
        if (!text || !this.apiKey) {
            logger.warn("Speak", "Missing text or API Key. Falling back to silence/skip.");
            if (onEnd) onEnd();
            return;
        }

        // 2. Generate Key for Cache
        const key = this.cache.generateKey(text, this.voice.name, this.rate, this.pitch);

        try {
            // 3. Check Cache
            let blob = await this.cache.get(key);
            
            // Check Race Condition 1: If request changed while reading cache (fast, but possible)
            if (reqId !== this.currentReqId) return;

            if (!blob) {
                // 4. Fetch from Cloud
                logger.info("Speak", "Fetching from Cloud...");
                blob = await this.fetcher.fetchAudio(text, this.voice.lang, this.voice.name, this.rate, this.pitch);
                
                // Check Race Condition 2: If request changed while fetching (slow, likely)
                if (reqId !== this.currentReqId) {
                    logger.debug("Speak", "Request cancelled (stale)");
                    return;
                }

                // 5. Save to Cache (Background)
                this.cache.put(key, blob).then(() => {
                    if (this.onAudioCached) this.onAudioCached(text);
                });
            } else {
                logger.info("Speak", "Using Cached Audio");
            }

            // 6. Play
            this.player.play(blob, onEnd);

        } catch (e) {
            if (reqId !== this.currentReqId) return; // Ignore errors from stale requests
            
            logger.error("Speak", "Failed to synthesize", e);
            if (onEnd) onEnd(); // Prevent app hang on error
        }
    }
    
    /**
     * Check if text is cached (for Smart Markers)
     */
    async isCached(text) {
        const key = this.cache.generateKey(text, this.voice.name, this.rate, this.pitch);
        const blob = await this.cache.get(key);
        return !!blob;
    }
    
    /**
     * Pre-loads audio for the next text segment
     */
    async prefetch(text) {
        if (!text || !this.apiKey) return;
        
        const key = this.cache.generateKey(text, this.voice.name, this.rate, this.pitch);
        const cached = await this.cache.get(key);
        
        if (!cached) {
            logger.debug("Prefetch", `Downloading: "${text.substring(0, 20)}..."`);
            try {
                const blob = await this.fetcher.fetchAudio(text, this.voice.lang, this.voice.name, this.rate, this.pitch);
                await this.cache.put(key, blob);
                if (this.onAudioCached) this.onAudioCached(text);
            } catch (e) {
                logger.warn("Prefetch", "Failed", e);
            }
        }
    }

    /**
     * Check if all texts in the list are cached for a specific voice.
     * @param {string[]} textList 
     * @param {string} voiceURI 
     */
    async checkOfflineStatusForVoice(textList, voiceURI) {
        if (!textList || textList.length === 0 || !voiceURI) return false;
        
        // Use Promise.all with short-circuit
        // But for many items, we want to fail fast.
        for (const text of textList) {
            const key = this.cache.generateKey(text, voiceURI, this.rate, this.pitch);
            const blob = await this.cache.get(key);
            if (!blob) return false;
        }
        return true;
    }

    pause() { this.player.pause(); }
    resume() { this.player.resume(); }
    stop() { 
        this.currentReqId++; // Invalidate pending fetches
        this.player.stop(); 
    }
}