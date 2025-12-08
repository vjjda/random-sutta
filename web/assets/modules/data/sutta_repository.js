// Path: web/assets/modules/data/sutta_repository.js
import { IndexStore } from './repository/index_store.js';
import { MetaStore } from './repository/meta_store.js';
import { ContentStore } from './repository/content_store.js';
import { AssetLoader } from './loader/asset_loader.js';
import { getLogger } from '../utils/logger.js';
import { ZipImporter } from './loader/zip_importer.js'; // [NEW]

const logger = getLogger("SuttaRepository");

export const SuttaRepository = {
    async init() {
        // [OPTIMIZATION] Không await IndexStore.init() ở đây nữa!
        // Hãy để nó chạy ngầm (Fire-and-forget)
        IndexStore.init().catch(err => logger.error("Init", "Background index load failed", err));
        logger.info("Init", "Repository ready (Index loading in background...)");
    },

    getLocation(uid) {
        // Hàm này giờ có thể trả về null nếu Index chưa tải xong.
        // Các logic gọi nó phải có cơ chế Fallback hoặc Wait nếu cần thiết.
        return IndexStore.get(uid);
    },

    async fetchMeta(bookId) {
        return await MetaStore.fetch(bookId);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        return await ContentStore.fetchChunk(bookId, chunkIdx);
    },

    async getMetaEntry(uid, hintBookId = null) {
        let bookId = hintBookId;
        
        // Nếu không có hint, buộc phải đợi Index tải xong
        if (!bookId) {
            await IndexStore.init(); // [WAIT] Chỉ đợi khi thực sự cần
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
        // Để lấy meta cho list UID (nav buttons), ta cần biết chúng thuộc sách nào.
        // Nên ở đây bắt buộc phải đợi Index.
        await IndexStore.init();

        const result = {};
        const booksToFetch = new Set();
        
        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) booksToFetch.add(loc[0]);
        });

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
     * [UPDATED] Tải toàn bộ dữ liệu (Advanced Zip Strategy)
     */
    async downloadAll(onProgress) {
        await this.init();

        if (AssetLoader.isOfflineMode()) {
            logger.info("DownloadAll", "Offline Mode detected. Skipping.");
            if (onProgress) onProgress(100, 100);
            return;
        }

        try {
            logger.info("DownloadAll", "Starting Zip Strategy...");
            await ZipImporter.run(onProgress);
            logger.info("DownloadAll", "Sync completed successfully.");
        } catch (e) {
            logger.error("DownloadAll", "Zip Strategy failed", e);
            throw e;
        }
    }
};