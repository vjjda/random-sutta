// Path: web/assets/modules/tts/engines/gcloud/voice_manager.js
import { getLogger } from '../../../utils/logger.js'; // [FIXED] 3 levels up (modules/utils/logger.js)
import { AppConfig } from '../../../core/app_config.js'; // 3 levels up (modules/core/app_config.js)

const logger = getLogger("GCloud_VoiceMgr");

// [UPDATED] Bump version to v3 to force refresh list without Standard/Wavenet
const CACHE_KEYS = {
    LIST: "tts_gcloud_voices_list_v3", 
    TS: "tts_gcloud_voices_ts_v3"
};
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; 

export class GCloudVoiceManager {
    constructor(fetcher, configManager) {
        this.fetcher = fetcher;
        this.config = configManager;
        this.availableVoices = [];
        this.onVoicesChanged = null;

        this._loadFromCache();
    }

    _loadFromCache() {
        const cached = localStorage.getItem(CACHE_KEYS.LIST);
        if (cached) {
            try {
                this.availableVoices = JSON.parse(cached);
            } catch (e) { /* ignore */ }
        }
    }

    async refresh(force = false) {
        const apiKey = this.config.getApiKey();
        if (!apiKey) return;

        const lastUpdate = parseInt(localStorage.getItem(CACHE_KEYS.TS) || "0");
        const now = Date.now();

        if (!force && this.availableVoices.length > 0 && (now - lastUpdate < CACHE_DURATION)) {
            logger.info("Voices", "Using cached list.");
            this._notify();
            return;
        }

        try {
            logger.info("Voices", "Fetching from API...");
            const rawVoices = await this.fetcher.fetchVoices();
            
            // 1. Strict Filter: High Quality Only
            this.availableVoices = rawVoices
                .filter(v => {
                    const id = v.name;
                    return (v.languageCodes.includes("en-US") || v.languageCodes.includes("en-GB")) &&
                           id.startsWith("en-") && 
                           id.includes("-") &&
                           !id.includes("Standard") && // Remove Legacy Standard
                           !id.includes("Wavenet");    // [NEW] Remove Legacy Wavenet
                })
                .map(v => ({
                    name: `${v.name} (${v.ssmlGender})`,
                    voiceURI: v.name,
                    lang: v.languageCodes[0]
                }));
            
            this.availableVoices.sort((a, b) => a.name.localeCompare(b.name));

            this._ensureValidSelection();

            localStorage.setItem(CACHE_KEYS.LIST, JSON.stringify(this.availableVoices));
            localStorage.setItem(CACHE_KEYS.TS, now.toString());
            
            this._notify();
            logger.info("Voices", `Updated ${this.availableVoices.length} premium voices.`);

        } catch (e) {
            logger.error("Voices", "Refresh failed", e);
            this.availableVoices = []; 
            localStorage.removeItem(CACHE_KEYS.LIST);
            if (this.onVoicesChanged) this.onVoicesChanged([], null);
        }
    }

    _ensureValidSelection() {
        const currentVoice = this.config.getVoice();
        const isValid = this.availableVoices.some(v => v.voiceURI === currentVoice.voiceURI);

        if (!isValid) {
            const defaultURI = AppConfig.TTS?.DEFAULT_VOICE?.voiceURI;
            const defaultVoice = this.availableVoices.find(v => v.voiceURI === defaultURI);

            if (defaultVoice) {
                this.config.setVoice(defaultVoice);
                logger.info("Voices", `Auto-selected default: ${defaultVoice.name}`);
            } else if (this.availableVoices.length > 0) {
                this.config.setVoice(this.availableVoices[0]);
            }
        } else {
            const found = this.availableVoices.find(v => v.voiceURI === currentVoice.voiceURI);
            if (found) this.config.setVoice(found);
        }
    }

    _notify() {
        if (this.onVoicesChanged) {
            this.onVoicesChanged(this.availableVoices, this.config.getVoice());
        }
    }

    getList() { return this.availableVoices; }
}