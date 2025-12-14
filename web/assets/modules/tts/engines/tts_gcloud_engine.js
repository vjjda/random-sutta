// Path: web/assets/modules/tts/engines/tts_gcloud_engine.js
import { TTSGoogleCloudFetcher } from './support/tts_gcloud_fetcher.js';
import { TTSAudioCache } from './support/tts_audio_cache.js';
import { TTSCloudAudioPlayer } from './support/tts_cloud_audio_player.js';
import { getLogger } from '../../utils/logger.js';
import { AppConfig } from '../../core/app_config.js'; 

const logger = getLogger("TTS_GCloudEngine");

export class TTSGoogleCloudEngine {
    constructor() {
        this.fetcher = new TTSGoogleCloudFetcher(null);
        this.cache = new TTSAudioCache();
        this.player = new TTSCloudAudioPlayer();
        
        // Default Config
        this.voice = AppConfig.TTS?.DEFAULT_VOICE || { 
            voiceURI: "en-US-Neural2-D", 
            name: "Google US Neural2-D", 
            lang: "en-US" 
        };
        this.rate = 1.0;
        this.apiKey = localStorage.getItem("tts_gcloud_key") || "";
        
        this.fetcher.setApiKey(this.apiKey);
        this.availableVoices = []; 
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
        this.onAudioCached = null;
        
        this.currentReqId = 0;
    }

    setApiKey(key) {
        this.apiKey = key;
        this.fetcher.setApiKey(key);
        localStorage.setItem("tts_gcloud_key", key);
        
        if (key) {
            // Force refresh và clear cache cũ để tránh dữ liệu rác
            this.refreshVoices(true); 
        }
    }
    
    async refreshVoices(force = false) {
        if (!this.apiKey) return;

        const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
        const lastUpdate = parseInt(localStorage.getItem("tts_gcloud_voices_ts") || "0");
        const now = Date.now();

        if (!force && this.availableVoices.length > 0 && (now - lastUpdate < CACHE_DURATION)) {
            logger.info("Voices", "Using cached voice list.");
            if (this.onVoicesChanged) this.onVoicesChanged(this.availableVoices, this.voice);
            return;
        }

        try {
            const rawVoices = await this.fetcher.fetchVoices();
            
            // [FIXED] Strict Filter & Mapping
            // Google ID chuẩn phải có dạng "en-US-WxYz..." (chứa dấu gạch ngang và bắt đầu bằng mã ngữ)
            this.availableVoices = rawVoices
                .filter(v => {
                    const id = v.name;
                    // Lọc: Phải là tiếng Anh, và ID phải chuẩn (tránh các ID ngắn như "Algenib")
                    return (v.languageCodes.includes("en-US") || v.languageCodes.includes("en-GB")) &&
                           id.includes("-") && 
                           id.startsWith("en-");
                })
                .map(v => ({
                    name: `${v.name} (${v.ssmlGender})`, // Tên hiển thị gốc (có thể làm đẹp sau ở Renderer)
                    voiceURI: v.name, // QUAN TRỌNG: Đây phải là ID chuẩn của Google
                    lang: v.languageCodes[0]
                }));
            
            // Sort by name
            this.availableVoices.sort((a, b) => a.name.localeCompare(b.name));

            // AUTO-SELECT DEFAULT VOICE
            const isCurrentValid = this.availableVoices.some(v => v.voiceURI === this.voice.voiceURI);
            
            if (!isCurrentValid) {
                const defaultURI = AppConfig.TTS?.DEFAULT_VOICE?.voiceURI;
                const defaultVoice = this.availableVoices.find(v => v.voiceURI === defaultURI);
                
                if (defaultVoice) {
                    this.setVoice(defaultVoice.voiceURI);
                    logger.info("Voices", `Auto-selected default: ${defaultVoice.name}`);
                } else if (this.availableVoices.length > 0) {
                    this.setVoice(this.availableVoices[0].voiceURI);
                }
            }

            // Save Cache
            localStorage.setItem("tts_gcloud_voices_list", JSON.stringify(this.availableVoices));
            localStorage.setItem("tts_gcloud_voices_ts", now.toString());
            
            if (this.onVoicesChanged) {
                this.onVoicesChanged(this.availableVoices, this.voice);
            }
            logger.info("Voices", `Loaded ${this.availableVoices.length} voices from GCloud.`);

        } catch (e) {
            logger.error("Voices", "Failed to refresh voices (Invalid Key or Network)", e);
            this.availableVoices = [];
            localStorage.removeItem("tts_gcloud_voices_list"); 
            if (this.onVoicesChanged) {
                this.onVoicesChanged([], null);
            }
        }
    }

    getVoices() { return this.availableVoices; }

    setVoice(voiceURI) {
        const found = this.availableVoices.find(v => v.voiceURI === voiceURI);
        
        if (found) {
            this.voice = { ...found }; // Clone object
            localStorage.setItem("tts_gcloud_voice", voiceURI);
        } else if (voiceURI) {
            // Temporary set for initial load
            this.voice = { voiceURI: voiceURI, name: voiceURI, lang: "en-US" };
            localStorage.setItem("tts_gcloud_voice", voiceURI);
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_gcloud_rate", this.rate);
        if (this.player && this.player.setRate) {
            this.player.setRate(this.rate);
        }
    }
    
    _loadSettings() {
         const savedVoice = localStorage.getItem("tts_gcloud_voice");
         if (savedVoice) this.setVoice(savedVoice);
         
         const savedRate = localStorage.getItem("tts_gcloud_rate");
         if (savedRate) this.rate = parseFloat(savedRate);
    }

    async speak(text, onEnd, onBoundary) {
        this.currentReqId++;
        const reqId = this.currentReqId;

        if (!this.apiKey) {
            logger.error("Speak", "API key is missing.");
            throw new Error("API key is missing.");
        }
        if (!text) {
            if (onEnd) onEnd();
            return;
        }

        const key = this.cache.generateKey(text, this.voice.voiceURI, 1.0, 0.0);
        try {
            let blob = await this.cache.get(key);
            if (reqId !== this.currentReqId) return;

            if (!blob) {
                logger.info("Speak", "Fetching from Cloud...");
                // Validate URI trước khi fetch
                if (!this.voice.voiceURI.includes("-")) {
                     throw new Error(`Invalid Voice ID: ${this.voice.voiceURI}`);
                }

                blob = await this.fetcher.fetchAudio(text, this.voice.lang, this.voice.voiceURI, 1.0, 0.0);
                
                if (reqId !== this.currentReqId) return;

                this.cache.put(key, blob).then(() => {
                    if (this.onAudioCached) this.onAudioCached(text);
                });
            } else {
                logger.info("Speak", "Using Cached Audio");
            }

            this.player.play(blob, onEnd, this.rate);
        } catch (e) {
            if (reqId !== this.currentReqId) return;
            logger.error("Speak", "Failed to synthesize", e);
            if (onEnd) onEnd();
        }
    }
    
    async isCached(text) {
        const key = this.cache.generateKey(text, this.voice.voiceURI, 1.0, 0.0);
        const blob = await this.cache.get(key);
        return !!blob;
    }
    
    async prefetch(text) {
        if (!text || !this.apiKey) return;
        const key = this.cache.generateKey(text, this.voice.voiceURI, 1.0, 0.0);
        const cached = await this.cache.get(key);
        
        if (!cached) {
            try {
                const blob = await this.fetcher.fetchAudio(text, this.voice.lang, this.voice.voiceURI, 1.0, 0.0);
                await this.cache.put(key, blob);
                if (this.onAudioCached) this.onAudioCached(text);
            } catch (e) {
                logger.warn("Prefetch", `Failed for "${text.substring(0, 30)}..."`, e);
            }
        }
    }

    async getOfflineVoices(textList) {
        if (!textList || textList.length === 0) return [];
        const offlineVoices = [];
        for (const voice of this.availableVoices) {
            // Logic check cache đơn giản
            const key = this.cache.generateKey(textList[0], voice.voiceURI, 1.0, 0.0);
            const blob = await this.cache.get(key);
            if (blob) offlineVoices.push(voice.voiceURI);
        }
        return offlineVoices;
    }

    pause() { this.player.pause(); }
    resume() { this.player.resume(); }
    stop() { 
        this.currentReqId++;
        this.player.stop();
    }
}