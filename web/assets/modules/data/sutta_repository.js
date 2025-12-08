// Path: web/assets/modules/data/sutta_repository.js
import { IndexStore } from './repository/index_store.js';
import { MetaStore } from './repository/meta_store.js';
import { ContentStore } from './repository/content_store.js';
import { AssetLoader } from './loader/asset_loader.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

export const SuttaRepository = {
    // --- Public API ---
    
    async init() {
        await IndexStore.init();
    },

    getLocation(uid) {
        return IndexStore.get(uid);
    },

    async fetchMeta(bookId) {
        return await MetaStore.fetch(bookId);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        return await ContentStore.fetchChunk(bookId, chunkIdx);
    },

    // API cũ giữ lại cho Service
    async getMetaEntry(uid, hintBookId = null) {
        let bookId = hintBookId;
        if (!bookId) {
            const loc = this.getLocation(uid);
            if (loc) bookId = loc[0];
        }
        if (!bookId) return null;

        const bookMeta = await MetaStore.fetch(bookId);
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

        // Parallel fetch
        await Promise.all(Array.from(booksToFetch).map(id => MetaStore.fetch(id)));

        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) {
                const bookId = loc[0];
                const entry = MetaStore.getCachedEntry(bookId, uid);
                if (entry) result[uid] = entry;
            }
        });

        return result;
    },

    /**
     * Tải toàn bộ dữ liệu để Service Worker cache.
     * Sử dụng hàng đợi để tránh nghẽn mạng.
     */
    async downloadAll(onProgress) {
        await this.init();

        // Nếu đang Offline thì không cần tải (vì file đã có sẵn trong gói zip/folder)
        if (AssetLoader.isOfflineMode()) {
            logger.info("DownloadAll", "Already in Offline Mode. Skipping download.");
            if (onProgress) onProgress(100, 100);
            return;
        }
        
        const index = IndexStore.getAll();
        if (!index) {
            logger.error("DownloadAll", "Index not loaded");
            return;
        }

        logger.info("DownloadAll", "Scanning index for assets...");
        
        // 1. Thu thập URL
        const metaSet = new Set();
        const contentSet = new Set();

        Object.values(index).forEach(loc => {
            if (!loc) return;
            const [bookId, chunkIdx] = loc;
            metaSet.add(bookId);
            if (chunkIdx !== null) {
                contentSet.add(`${bookId}_chunk_${chunkIdx}`);
            }
        });

        const tasks = [];
        metaSet.forEach(id => tasks.push(`assets/db/meta/${id}.json`));
        contentSet.forEach(key => tasks.push(`assets/db/content/${key}.json`));

        logger.info("DownloadAll", `Found ${tasks.length} files to sync.`);

        // 2. Chạy hàng đợi (Concurrency Limit)
        const CONCURRENCY_LIMIT = 5;
        let completed = 0;
        let hasError = false;

        const processTask = async (url) => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                // Không cần await resp.json() hay lưu vào RAM
                // Chỉ cần fetch thành công là SW đã cache rồi.
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