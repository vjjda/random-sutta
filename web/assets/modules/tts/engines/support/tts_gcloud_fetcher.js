// Path: web/assets/modules/tts/engines/support/tts_gcloud_fetcher.js
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger("TTS_GCloudFetcher");

const API_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

export class TTSGoogleCloudFetcher {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    /**
     * Fetches audio for the given text.
     * @param {string} text 
     * @param {string} languageCode (e.g., "en-US")
     * @param {string} voiceName (e.g., "en-US-Neural2-D")
     * @param {number} speakingRate (0.25 to 4.0)
     * @param {number} pitch (-20.0 to 20.0)
     * @returns {Promise<Blob>} Audio Blob
     */
    async fetchAudio(text, languageCode = "en-US", voiceName = "en-US-Neural2-D", speakingRate = 1.0, pitch = 0.0) {
        if (!this.apiKey) {
            throw new Error("Missing Google Cloud API Key");
        }

        // [Fix] Clamp values to API limits to prevent 400 Bad Request
        const safeRate = Math.max(0.25, Math.min(4.0, Number(speakingRate)));
        const safePitch = Math.max(-20.0, Math.min(20.0, Number(pitch)));

        const payload = {
            input: { text: text },
            voice: {
                languageCode: languageCode,
                name: voiceName
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: safeRate,
                pitch: safePitch,
                effectsProfileId: ["headphone-class-device"]
            }
        };

        const url = `${API_ENDPOINT}?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // [Debug] Log payload details on error
                logger.error("Fetch", `API Error ${response.status}: ${JSON.stringify(errorData)}`);
                logger.debug("Fetch", `Failed Payload: Rate=${safeRate}, Pitch=${safePitch}, TextLen=${text.length}`);
                throw new Error(`Google TTS API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            if (data.audioContent) {
                // Convert Base64 to Blob
                return this._base64ToBlob(data.audioContent, "audio/mp3");
            } else {
                throw new Error("No audio content received");
            }

        } catch (e) {
            logger.error("Fetch", "Network or logic error", e);
            throw e;
        }
    }

    _base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Fetches list of available voices from Google Cloud.
     * @returns {Promise<Array>} List of voices
     */
    async fetchVoices() {
        if (!this.apiKey) {
            throw new Error("Missing Google Cloud API Key");
        }

        const url = `https://texttospeech.googleapis.com/v1/voices?key=${this.apiKey}&languageCode=en-US`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch voices");
            }
            const data = await response.json();
            return data.voices || [];
        } catch (e) {
            logger.error("FetchVoices", "Error", e);
            throw e;
        }
    }
}