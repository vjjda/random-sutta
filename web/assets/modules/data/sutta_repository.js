// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

// Cache In-Memory
const CACHE = {
    meta: new Map(),    
    content: new Map(), 
    index: null         
};

// Pending Promises cho việc load script (để tránh load trùng)
const PENDING_REQUESTS = new Map();

export const SuttaRepository = {
    async init() {
        // Setup Global Loader cho chế độ Offline (JSONP style)
        this._setupOfflineLoader();

        if (CACHE.index) return;
        
        // 1. Check Offline Index (được inject bởi build system)
        if (window.__DB_INDEX__) {
            CACHE.index = window.__DB_INDEX__;
            logger.info("Init", "Loaded Index from Global Variable (Offline Mode)");
            return;
        }

        // 2. Fetch Network (Online Mode)
        try {
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            CACHE.index = await resp.json();
            logger.info("Init", "Loaded Index from Network");
        } catch (e) {
            logger.error("Init", "Failed to load uid_index.json", e);
            // Không throw để app không crash hoàn toàn, user vẫn có thể thấy giao diện
        }
    },

    /**
     * Thiết lập cầu nối để hứng dữ liệu từ các file .js (Offline)
     */
    _setupOfflineLoader() {
        if (!window.__DB_LOADER__) {
            window.__DB_LOADER__ = {
                // Hàm này sẽ được gọi bởi file .js sau khi load (vd: an1.js)
                receive: (key, data) => {
                    // Resolve promise đang đợi
                    if (PENDING_REQUESTS.has(key)) {
                        const { resolve } = PENDING_REQUESTS.get(key);
                        resolve(data);
                        PENDING_REQUESTS.delete(key);
                    } else {
                        // Trường hợp load trước khi cần (ít gặp), cache tạm vào loader
                        // (Logic này có thể mở rộng nếu cần pre-load)
                    }
                }
            };
        }
    },

    /**
     * Kiểm tra xem đang chạy ở chế độ nào để chọn cách load
     */
    _isOfflineMode() {
        // Dấu hiệu nhận biết build offline: Có biến global index hoặc chạy trên file://
        return window.__DB_INDEX__ !== undefined || window.location.protocol === 'file:';
    },

    /**
     * Hàm đa năng: Tải dữ liệu qua Fetch hoặc Script Tag
     */
    async _loadData(type, key, pathBase) {
        // 1. Check Cache
        const cacheMap = type === 'meta' ? CACHE.meta : CACHE.content;
        if (cacheMap.has(key)) return cacheMap.get(key);

        // 2. Check Pending (Dedup requests)
        if (PENDING_REQUESTS.has(key)) {
            return PENDING_REQUESTS.get(key).promise;
        }

        // 3. Thực thi Load
        if (this._isOfflineMode()) {
            // --- OFFLINE STRATEGY (Script Injection) ---
            return new Promise((resolve, reject) => {
                // Tạo entry trong pending map
                PENDING_REQUESTS.set(key, { resolve, reject });

                const script = document.createElement('script');
                // Offline build đổi đuôi .json -> .js
                script.src = `assets/db/${pathBase}.js`;
                script.async = true;
                
                script.onerror = () => {
                    PENDING_REQUESTS.delete(key);
                    logger.warn("_loadData", `Failed to load script: ${script.src}`);
                    reject(new Error(`Script load failed: ${key}`));
                    script.remove(); // Cleanup
                };

                script.onload = () => {
                    // Dữ liệu sẽ được resolve thông qua window.__DB_LOADER__.receive
                    // Script tag xong việc thì bỏ đi cho gọn DOM
                    script.remove();
                    
                    // Lưu ý: Resolve thực sự xảy ra bên trong receive(), 
                    // nhưng ta cần handle cache ở đây sau khi receive xong?
                    // Không, receive() nhận data raw. Ta nên cache ở wrapper này.
                };
                
                // Wrap resolve để cache dữ liệu khi nhận được
                const originalResolve = resolve;
                PENDING_REQUESTS.get(key).resolve = (data) => {
                    cacheMap.set(key, data);
                    originalResolve(data);
                };

                document.body.appendChild(script);
            });

        } else {
            // --- ONLINE STRATEGY (Fetch) ---
            const url = `assets/db/${pathBase}.json`;
            try {
                const resp = await fetch(url);
                if (!resp.ok) return null;
                const data = await resp.json();
                cacheMap.set(key, data);
                return data;
            } catch (e) {
                logger.warn("_loadData", `Fetch failed: ${url}`, e);
                return null;
            }
        }
    },

    getLocation(uid) {
        if (!CACHE.index) return null;
        return CACHE.index[uid] || null;
    },

    async fetchMeta(bookId) {
        // key cache là bookId (vd: "mn", "an1")
        // path file là meta/{bookId}
        return this._loadData('meta', bookId, `meta/${bookId}`);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        // key cache là {bookId}_chunk_{idx}
        // path file là content/{bookId}_chunk_{idx}
        const key = `${bookId}_chunk_${chunkIdx}`;
        return this._loadData('content', key, `content/${key}`);
    },

    async getMetaEntry(uid, hintBookId = null) {
        let bookId = hintBookId;
        if (!bookId) {
            const loc = this.getLocation(uid);
            if (loc) bookId = loc[0];
        }
        
        if (!bookId) return null;

        const bookMeta = await this.fetchMeta(bookId);
        if (!bookMeta || !bookMeta.meta) return null;

        const entry = bookMeta.meta[uid];
        if (entry) {
            entry._book_id = bookId;
            entry._root_title = bookMeta.super_book_title || bookMeta.title;
            entry._tree = bookMeta.tree;
        }
        return entry;
    },

    async fetchMetaList(uids) {
        const result = {};
        const booksToFetch = new Set();
        
        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) booksToFetch.add(loc[0]);
        });

        const promises = Array.from(booksToFetch).map(bookId => this.fetchMeta(bookId));
        await Promise.all(promises);

        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) {
                const bookId = loc[0];
                const bookData = CACHE.meta.get(bookId);
                if (bookData && bookData.meta && bookData.meta[uid]) {
                    result[uid] = bookData.meta[uid];
                }
            }
        });

        return result;
    },

    /**
     * Logic Download All:
     * - Online: Fetch JSON để SW cache.
     * - Offline: Không cần làm gì (vì file JS đã nằm sẵn trong gói zip/folder).
     */
    async downloadAll(onProgress) {
        await this.init(); 
        
        if (this._isOfflineMode()) {
            logger.info("DownloadAll", "Already in Offline Mode (Files are local).");
            if (onProgress) onProgress(100, 100);
            return;
        }

        if (!CACHE.index) {
            logger.error("DownloadAll", "Index not loaded");
            return;
        }

        logger.info("DownloadAll", "Scanning index for assets...");
        
        const metaSet = new Set();
        const contentSet = new Set();

        Object.values(CACHE.index).forEach(loc => {
            if (!loc) return;
            const [bookId, chunkIdx] = loc;
            metaSet.add(bookId);
            if (chunkIdx !== null) {
                contentSet.add(`${bookId}_chunk_${chunkIdx}`);
            }
        });

        const tasks = [];
        metaSet.forEach(bookId => tasks.push(`assets/db/meta/${bookId}.json`));
        contentSet.forEach(key => tasks.push(`assets/db/content/${key}.json`));

        logger.info("DownloadAll", `Found ${tasks.length} files to sync.`);

        const CONCURRENCY_LIMIT = 5;
        let completed = 0;
        let hasError = false;

        const processTask = async (url) => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            } catch (e) {
                logger.warn("DownloadAll", `Failed: ${url}`, e);
                hasError = true;
            } finally {
                completed++;
                if (onProgress) onProgress(completed, tasks.length);
            }
        };

        const queue = [...tasks];
        const activeWorkers = [];

        while (queue.length > 0 || activeWorkers.length > 0) {
            while (queue.length > 0 && activeWorkers.length < CONCURRENCY_LIMIT) {
                const url = queue.shift();
                const worker = processTask(url).then(() => {
                    activeWorkers.splice(activeWorkers.indexOf(worker), 1);
                });
                activeWorkers.push(worker);
            }
            if (activeWorkers.length > 0) {
                await Promise.race(activeWorkers);
            }
        }

        if (hasError) throw new Error("Some files failed to download.");
        logger.info("DownloadAll", "Sync completed successfully.");
    }
};