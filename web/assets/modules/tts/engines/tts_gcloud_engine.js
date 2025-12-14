// Path: web/assets/modules/tts/engines/tts_gcloud_engine.js
import { TTSGoogleCloudFetcher } from './support/tts_gcloud_fetcher.js';
import { TTSAudioCache } from './support/tts_audio_cache.js';
import { TTSCloudAudioPlayer } from './support/tts_cloud_audio_player.js';
import { getLogger } from '../../utils/logger.js';
import { AppConfig } from '../../core/app_config.js'; 

const logger = getLogger("TTS_GCloudEngine");

// Cache keys (v2 to invalidate old bad data)
const CACHE_KEY_LIST = "tts_gcloud_voices_list_v2";
const CACHE_KEY_TS = "tts_gcloud_voices_ts_v2";

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

        // Try loading cached voices
        const cachedVoices = localStorage.getItem(CACHE_KEY_LIST);
        if (cachedVoices) {
            try {
                this.availableVoices = JSON.parse(cachedVoices);
            } catch(e) { /* ignore */ }
        }

        // Callbacks
        this.onVoicesChanged = null;
        this.onAudioCached = null;
        
        this.currentReqId = 0;

        // [FIX] Tự động tải danh sách giọng ngay khi khởi tạo nếu đã có Key
        if (this.apiKey) {
            // Dùng setTimeout để đảm bảo UI (Orchestrator) đã kịp bind event onVoicesChanged
            setTimeout(() => this.refreshVoices(false), 100);
        }
    }

    setApiKey(key) {
        this.apiKey = key;
        this.fetcher.setApiKey(key);
        localStorage.setItem("tts_gcloud_key", key);
        
        if (key) {
            this.refreshVoices(true); // Force refresh khi nhập key mới
        }
    }
    
    async refreshVoices(force = false) {
        if (!this.apiKey) return;

        const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
        const lastUpdate = parseInt(localStorage.getItem(CACHE_KEY_TS) || "0");
        const now = Date.now();

        // Nếu cache còn mới và không force -> Dùng cache
        if (!force && this.availableVoices.length > 0 && (now - lastUpdate < CACHE_DURATION)) {
            logger.info("Voices", "Using cached voice list.");
            // Trigger UI update ngay để đồng bộ
            if (this.onVoicesChanged) this.onVoicesChanged(this.availableVoices, this.voice);
            return;
        }

        try {
            logger.info("Voices", "Fetching voice list from Google API...");
            const rawVoices = await this.fetcher.fetchVoices();
            
            // Strict Filter
            this.availableVoices = rawVoices
                .filter(v => {
                    const id = v.name;
                    return (v.languageCodes.includes("en-US") || v.languageCodes.includes("en-GB")) &&
                           id.startsWith("en-") && 
                           id.includes("-");
                })
                .map(v => ({
                    name: `${v.name} (${v.ssmlGender})`,
                    voiceURI: v.name,
                    lang: v.languageCodes[0]
                }));
            
            this.availableVoices.sort((a, b) => a.name.localeCompare(b.name));

            // Auto-select Default if current is invalid
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
            localStorage.setItem(CACHE_KEY_LIST, JSON.stringify(this.availableVoices));
            localStorage.setItem(CACHE_KEY_TS, now.toString());
            
            if (this.onVoicesChanged) {
                this.onVoicesChanged(this.availableVoices, this.voice);
            }
            logger.info("Voices", `Loaded ${this.availableVoices.length} voices from GCloud.`);

        } catch (e) {
            logger.error("Voices", "Failed to refresh voices", e);
            // Xóa cache để tránh kẹt
            this.availableVoices = [];
            localStorage.removeItem(CACHE_KEY_LIST); 
            
            if (this.onVoicesChanged) {
                this.onVoicesChanged([], null);
            }
        }
    }

    getVoices() { return this.availableVoices; }

    setVoice(voiceURI) {
        const found = this.availableVoices.find(v => v.voiceURI === voiceURI);
        if (found) {
            this.voice = { ...found }; 
            localStorage.setItem("tts_gcloud_voice", voiceURI);
        } else if (voiceURI) {
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
            if (onEnd) onEnd(); return;
        }

        if (!this.voice.voiceURI || !this.voice.voiceURI.includes("-")) {
             logger.error("Speak", `Invalid Voice ID: ${this.voice.voiceURI}`);
             if (onEnd) onEnd();
             return;
        }

        const key = this.cache.generateKey(text, this.voice.voiceURI, 1.0, 0.0);
        try {
            let blob = await this.cache.get(key);
            if (reqId !== this.currentReqId) return;

            if (!blob) {
                logger.info("Speak", "Fetching from Cloud...");
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
                logger.warn("Prefetch", `Failed`, e);
            }
        }
    }

    async getOfflineVoices(textList) {
        if (!textList || textList.length === 0) return [];
        const offlineVoices = [];
        for (const voice of this.availableVoices) {
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