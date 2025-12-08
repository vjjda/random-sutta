// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';
// [NOTE] Cần đảm bảo constants.js export PRIMARY_BOOKS
import { PRIMARY_BOOKS } from './constants.js'; 

const logger = getLogger("SuttaRepo");

// --- INTERNAL STATE (RAM CACHE) ---
// Key: "bookId_chunkIdx" (ví dụ: "mn_0")
const _chunkCache = new Map();
// Key: "bookId"
const _metaCache = new Map();
// Key: "uid"
let _uidIndex = null; // Stored locator map

export const SuttaRepository = {
    
    async init() {
        await this.ensureIndex();
        
        // Kích hoạt tải ngầm thông minh sau 3 giây
        setTimeout(() => {
            this.startSmartPreload();
        }, 3000);
    },

    // --- Index Management ---
    async ensureIndex() {
        if (_uidIndex) return;
        try {
            const resp = await fetch('./assets/db/uid_index.json');
            _uidIndex = await resp.json();
        } catch (e) {
            logger.error("init", "Failed to load UID Index", e);
        }
    },

    getLocation(uid) {
        if (!_uidIndex) return null;
        return _uidIndex[uid]; // Trả về [book_id, chunk_idx]
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
            const resp = await fetch(`./assets/db/meta/${bookId}.json`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            
            const data = await resp.json();
            _metaCache.set(bookId, data); // Lưu vào RAM
            return data;
        } catch (e) {
            logger.error("fetchMeta", `Failed ${bookId}`, e);
            return null;
        }
    },

    async fetchMetaList(bookIds) {
        const results = {};
        const uniqueBooks = [...new Set(bookIds.map(uid => {
            const loc = this.getLocation(uid);
            return loc ? loc[0] : null;
        }).filter(b => b))];

        await Promise.all(uniqueBooks.map(b => this.fetchMeta(b)));

        bookIds.forEach(uid => {
            const loc = this.getLocation(uid);
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
            const fileName = `${bookId}_chunk_${chunkIdx}.json`;
            const resp = await fetch(`./assets/db/content/${fileName}`);
            
            if (!resp.ok) throw new Error(`Chunk missing: ${fileName}`);
            
            const data = await resp.json();
            
            // 3. Store in RAM Cache (Quan trọng)
            _chunkCache.set(cacheKey, data);
            
            return data;
        } catch (e) {
            logger.error("fetchContent", `Failed ${cacheKey}`, e);
            return null;
        }
    },

    // [UPDATED] Real Download Logic for Offline Mode
    async downloadAll(onProgress) {
        await this.ensureIndex();
        if (!_uidIndex) throw new Error("Index not loaded");

        // 1. Identify all resources needed
        const allMetaBooks = new Set();
        const allChunks = new Set(); // format: "bookId|chunkIdx"

        // Scan index to find all books and chunks
        for (const [uid, loc] of Object.entries(_uidIndex)) {
            const [bookId, chunkIdx] = loc;
            allMetaBooks.add(bookId);
            allChunks.add(`${bookId}|${chunkIdx}`);
        }

        const tasks = [];

        // Meta Tasks
        for (const bookId of allMetaBooks) {
            tasks.push(async () => await this.fetchMeta(bookId));
        }

        // Content Chunk Tasks
        for (const chunkStr of allChunks) {
            const [bookId, chunkIdx] = chunkStr.split('|');
            tasks.push(async () => await this.fetchContentChunk(bookId, parseInt(chunkIdx)));
        }

        // 2. Execute with Concurrency Control
        const total = tasks.length;
        let completed = 0;
        const CONCURRENCY = 5; // Tải 5 file cùng lúc

        logger.info("DownloadAll", `Starting download of ${total} files...`);

        // Helper to run a batch
        const runBatch = async (batch) => {
            await Promise.all(batch.map(task => task().then(() => {
                completed++;
                if (onProgress) onProgress(completed, total);
            }).catch(e => {
                logger.warn("DownloadAll", "File failed (skipping)", e);
                // Vẫn tính là completed để thanh progress chạy tiếp
                completed++;
                if (onProgress) onProgress(completed, total);
            })));
        };

        // Split into batches
        for (let i = 0; i < total; i += CONCURRENCY) {
            const batch = tasks.slice(i, i + CONCURRENCY);
            await runBatch(batch);
            
            // Yield to UI thread every few batches
            if (i % (CONCURRENCY * 2) === 0) {
                await new Promise(r => setTimeout(r, 10)); 
            }
        }

        logger.info("DownloadAll", "Full download completed.");
    }
};