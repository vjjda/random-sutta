// Path: web/assets/modules/tts/engines/support/tts_audio_cache.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("TTS_AudioCache");

const DB_NAME = 'tts_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

export class TTSAudioCache {
    constructor() {
        this.db = null;
        this.cachedKeys = new Set(); // [NEW] In-memory key index for O(1) checks
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
                this._migrateLegacyData(); 
                this._loadKeys(); // [NEW] Load keys into memory
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
     * [NEW] Load all keys into memory for fast synchronous checking
     */
    _loadKeys() {
        if (!this.db) return;
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => {
            if (request.result) {
                this.cachedKeys = new Set(request.result);
                logger.info("Cache", `Loaded ${this.cachedKeys.size} keys into memory.`);
            }
        };
    }

    /**
     * [NEW] Synchronous check if a key exists
     */
    hasKey(key) {
        return this.cachedKeys.has(key);
    }

    /**
     * [NEW] One-time migration to clean up legacy keys (with rate/pitch)
     * Strategy:
     * - Keep (Migrate): Items with rate=1, pitch=0 -> New Key "Voice|Text"
     * - Delete: Items with non-standard rate/pitch
     */
    _migrateLegacyData() {
        if (!this.db) return;
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                const oldKey = cursor.key;
                // Legacy Key Format: VoiceURI|Rate|Pitch|Text
                // New Key Format: VoiceURI|Text
                
                // Check if it looks like a legacy key (heuristic: contains parts)
                const parts = oldKey.split('|');
                
                // Legacy usually has 4 parts (if text doesn't contain |). 
                // But strictly checking for Rate=1 (index 1) and Pitch=0 (index 2)
                if (parts.length >= 4) {
                    const rate = parseFloat(parts[1]);
                    const pitch = parseFloat(parts[2]);
                    
                    // We only care about standard 1.0/0.0
                    const isStandard = (Math.abs(rate - 1.0) < 0.01) && (Math.abs(pitch - 0.0) < 0.01);
                    
                    if (isStandard) {
                        // Migrate: Construct new key
                        const voiceURI = parts[0];
                        // Text is everything after the 3rd pipe (index 3+)
                        const text = parts.slice(3).join('|');
                        const newKey = `${voiceURI}|${text}`;
                        
                        // Check if we already have the new key (rare but possible)
                        // Actually, put() will overwrite, so we just save new and delete old.
                        const newVal = { ...cursor.value, key: newKey };
                        store.put(newVal);
                        cursor.delete(); // Remove old key
                        // logger.debug("Migrate", `Converted: ${oldKey} -> ${newKey}`);
                    } else {
                        // Non-standard (Rate != 1 or Pitch != 0) -> Clean up
                        cursor.delete();
                        // logger.debug("Cleanup", `Removed non-standard: ${oldKey}`);
                    }
                }
                
                cursor.continue();
            } else {
                // Done
                // logger.info("Migrate", "Legacy data cleanup complete.");
            }
        };
    }

    /**
     * Generates a unique key for the cache entry.
     * [UPDATED] Ignore rate/pitch. We cache the raw audio (1.0x) and handle speed client-side.
     * @param {string} text 
     * @param {string} voiceURI 
     */
    generateKey(text, voiceURI) {
        // Cache key now depends ONLY on Voice and Text.
        // Rate is handled via HTML5 Audio playbackRate.
        // Pitch is ignored/standardized.
        return `${voiceURI}|${text.trim()}`;
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
                this.cachedKeys.add(key); // [NEW] Update memory index
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
         this.cachedKeys.clear(); // [NEW] Clear memory index
         logger.info("Cache", "Cleared all audio.");
    }
}