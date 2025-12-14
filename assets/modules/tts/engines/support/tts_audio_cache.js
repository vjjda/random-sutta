// Path: web/assets/modules/tts/engines/support/tts_audio_cache.js
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger("TTS_AudioCache");

const DB_NAME = 'tts_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

export class TTSAudioCache {
    constructor() {
        this.db = null;
        this.readyPromise = this._initDB();
    }

    _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                logger.error("DB", "Failed to open IndexedDB", event);
                reject(event);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                logger.info("DB", "IndexedDB connected");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Key path is the hash of the text + settings
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Generates a unique key for the cache entry.
     * @param {string} text 
     * @param {string} voiceURI 
     * @param {number} rate 
     * @param {number} pitch 
     */
    generateKey(text, voiceURI, rate, pitch = 0.0) {
        // Simple hash for now. In production, a proper hash function (SHA-256) is better,
        // but for client-side caching of short strings, a composite string key is acceptable.
        // We trim text and handle simple params.
        return `${voiceURI}|${rate}|${pitch}|${text.trim()}`;
    }

    async get(key) {
        await this.readyPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                if (request.result) {
                    logger.debug("Cache", "HIT");
                    resolve(request.result.blob);
                } else {
                    logger.debug("Cache", "MISS");
                    resolve(null);
                }
            };

            request.onerror = (e) => {
                logger.error("Cache", "Read Error", e);
                resolve(null); // Fail safe
            };
        });
    }

    async put(key, blob) {
        await this.readyPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const entry = {
                key: key,
                blob: blob,
                timestamp: Date.now()
            };

            const request = store.put(entry);

            request.onsuccess = () => {
                logger.debug("Cache", "Saved entry");
                resolve();
            };

            request.onerror = (e) => {
                logger.error("Cache", "Write Error", e);
                // Don't reject, just log. Caching failure shouldn't stop playback.
                resolve();
            };
        });
    }
    
    async clear() {
         await this.readyPromise;
         const transaction = this.db.transaction([STORE_NAME], 'readwrite');
         const store = transaction.objectStore(STORE_NAME);
         store.clear();
         logger.info("Cache", "Cleared all audio.");
    }
}