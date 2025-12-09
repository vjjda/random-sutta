// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';
// [NOTE] Cần đảm bảo constants.js export PRIMARY_BOOKS
import { PRIMARY_BOOKS } from './constants.js';
import { ZipImporter } from './loader/zip_importer.js';
import { AssetLoader } from './loader/asset_loader.js'; // [NEW]

const logger = getLogger("SuttaRepo");

// --- INTERNAL STATE (RAM CACHE) ---
// Key: "bookId_chunkIdx" (ví dụ: "mn_0")
const _chunkCache = new Map();
// Key: "bookId"
const _metaCache = new Map();
// Key: "char" -> Map<uid, loc>
const _indexCache = new Map(); // [NEW] Split Index Cache

export const SuttaRepository = {
    
    async init() {
        // [UPDATED] Check Offline Global Index
        if (window.__DB_INDEX__) {
            this._hydrateOfflineIndex(window.__DB_INDEX__);
        }
        
        // Kích hoạt tải ngầm thông minh sau 3 giây
        setTimeout(() => {
            this.startSmartPreload();
        }, 3000);
    },

    _hydrateOfflineIndex(fullIndex) {
        for (const [uid, loc] of Object.entries(fullIndex)) {
            if (!uid) continue;
            const char = uid[0].toLowerCase();
            const bucket = /[a-z0-9]/.test(char) ? char : '_';
            
            if (!_indexCache.has(bucket)) {
                _indexCache.set(bucket, {});
            }
            _indexCache.get(bucket)[uid] = loc;
        }
        logger.info("Offline", "Hydrated index from Global Variable.");
    },

    // [NEW] Load index part by character
    async _ensureIndexPart(char) {
        if (!char) return false;
        char = char.toLowerCase();
        if (!/[a-z0-9]/.test(char)) char = '_';

        if (_indexCache.has(char)) return true;

        try {
            const resp = await fetch(`./assets/db/index/${char}.json`);
            if (!resp.ok) {
                _indexCache.set(char, {}); // Mark as loaded but empty
                return false;
            }
            const data = await resp.json();
            _indexCache.set(char, data);
            return true;
        } catch (e) {
            return false;
        }
    },

    // [NEW] Async Locator (Network-aware)
    async resolveLocation(uid) {
        if (!uid) return null;
        
        // 1. Try sync lookup
        const loc = this.getLocation(uid);
        if (loc) return loc;

        // 2. Load Index
        await this._ensureIndexPart(uid[0]);
        
        // 3. Retry lookup
        return this.getLocation(uid);
    },

    // Sync Locator (Cache-only)
    getLocation(uid) {
        if (!uid) return null;
        const char = uid[0].toLowerCase();
        const bucket = /[a-z0-9]/.test(char) ? char : '_';
        
        const indexPart = _indexCache.get(bucket);
        if (!indexPart) return null;
        
        return indexPart[uid];
    },
    
    // --- Preload Logic ---
    startSmartPreload() {
        if ('requestIdleCallback' in window) {
            // Chỉ tải khi trình duyệt rảnh (không làm đơ UI)
            requestIdleCallback(() => this._preloadPrimaryBooks(), { timeout: 2000 });
        } else {
            // Fallback (dùng setTimeout)
            setTimeout(() => this._preloadPrimaryBooks(), 1000);
        }
    },

    async _preloadPrimaryBooks() {
        logger.info("Preload", "Starting background preload of Primary Books...");
        
        // 1. Preload Meta của các sách chính
        for (const bookId of PRIMARY_BOOKS) {
            if (!_metaCache.has(bookId)) {
                await this.fetchMeta(bookId);
                // Yield để main thread mượt mà
                await new Promise(r => setTimeout(r, 100)); 
            }
        }
        
        // 2. Preload Content của các sách nhỏ (thường chỉ 1 chunk 0)
        // Đây là ví dụ cho các sách thường được chọn (small books)
        const smallBooks = ['kp', 'dhp', 'ud', 'iti', 'snp'];
        for (const bookId of smallBooks) {
             await this.fetchContentChunk(bookId, 0); 
        }
        
        logger.info("Preload", "Background preload completed.");
    },

    // --- Fetchers (RAM Cache Included) ---
    async fetchMeta(bookId) {
        // 1. Check RAM Cache
        if (_metaCache.has(bookId)) {
            return _metaCache.get(bookId);
        }

        try {
            // [UPDATED] Use AssetLoader
            // Key must match the one in .js file (which is the filename stem)
            const data = await AssetLoader.load(bookId, `meta/${bookId}`);
            if (!data) throw new Error(`Meta missing: ${bookId}`);
            
            _metaCache.set(bookId, data); // Lưu vào RAM
            return data;
        } catch (e) {
            logger.error("fetchMeta", `Failed ${bookId}`, e);
            return null;
        }
    },

    async fetchMetaList(bookIds) {
        const results = {};
        
        // [UPDATED] Async resolution for all UIDs
        const locations = await Promise.all(bookIds.map(uid => this.resolveLocation(uid)));
        
        const uniqueBooks = new Set();
        locations.forEach(loc => {
            if (loc) uniqueBooks.add(loc[0]);
        });

        await Promise.all([...uniqueBooks].map(b => this.fetchMeta(b)));

        bookIds.forEach((uid, idx) => {
            const loc = locations[idx];
            if (loc) {
                const bookId = loc[0];
                const metaBook = _metaCache.get(bookId);
                if (metaBook && metaBook.meta && metaBook.meta[uid]) {
                    results[uid] = metaBook.meta[uid];
                }
            }
        });
        return results;
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const cacheKey = `${bookId}_${chunkIdx}`;

        // 1. Check RAM Cache (Zero latency)
        if (_chunkCache.has(cacheKey)) {
            return _chunkCache.get(cacheKey);
        }

        // 2. Fetch from Disk/Network
        try {
            const fileName = `${bookId}_chunk_${chunkIdx}`;
            // [UPDATED] Use AssetLoader
            // Key must match the one in .js file (fileName)
            const data = await AssetLoader.load(fileName, `content/${fileName}`);
            
            if (!data) throw new Error(`Chunk missing: ${fileName}`);
            
            // 3. Store in RAM Cache (Quan trọng)
            _chunkCache.set(cacheKey, data);
            
            return data;
        } catch (e) {
            logger.error("fetchContent", `Failed ${cacheKey}`, e);
            return null;
        }
    },

    // [UPDATED] Real Download Logic using Zip Bundle
    async downloadAll(onProgress) {
        // No index check needed for Zip
        logger.info("DownloadAll", "Starting optimized zip download...");
        
        try {
            // Delegate to ZipImporter to download, unzip and cache everything
            await ZipImporter.run(onProgress);
            logger.info("DownloadAll", "Full download completed via Zip.");
        } catch (e) {
            logger.error("DownloadAll", "Zip download failed", e);
            throw e; // Re-throw to let UI handle error state
        }
    }
};