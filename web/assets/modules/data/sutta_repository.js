// Path: web/assets/modules/data/sutta_repository.js
import { IndexStore } from './repository/index_store.js';
import { MetaStore } from './repository/meta_store.js';
import { ContentStore } from './repository/content_store.js';
import { AssetLoader } from './loader/asset_loader.js';
import { ZipImporter } from './loader/zip_importer.js'; // Module xử lý file nén
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

export const SuttaRepository = {
    // --- Public API ---
    
    /**
     * Khởi tạo Repository.
     * Chạy bất đồng bộ (Fire-and-forget) để không chặn UI khi khởi động app.
     */
    async init() {
        // IndexStore sẽ tự quyết định load từ Network hay Global Variable
        IndexStore.init().catch(err => {
            logger.warn("Init", "Background index load failed (will retry when needed)", err);
        });
        logger.info("Init", "Repository ready (Index loading in background...)");
    },

    /**
     * Đảm bảo Index đã được tải xong.
     * Các hàm cần tra cứu chính xác (như loadSutta từ URL) nên gọi hàm này.
     */
    async ensureIndex() {
        await IndexStore.init();
    },

    /**
     * Tra cứu vị trí của UID.
     * @returns [book_id, chunk_index] hoặc null
     */
    getLocation(uid) {
        return IndexStore.get(uid);
    },

    /**
     * Tải metadata của một cuốn sách.
     */
    async fetchMeta(bookId) {
        return await MetaStore.fetch(bookId);
    },

    /**
     * Tải một chunk nội dung.
     */
    async fetchContentChunk(bookId, chunkIdx) {
        return await ContentStore.fetchChunk(bookId, chunkIdx);
    },

    /**
     * Lấy thông tin Meta của một UID cụ thể.
     * Tự động tải file sách chứa nó nếu chưa có trong cache.
     */
    async getMetaEntry(uid, hintBookId = null) {
        let bookId = hintBookId;
        
        // Nếu không có hint, buộc phải tra cứu Index
        if (!bookId) {
            const loc = this.getLocation(uid);
            if (loc) {
                bookId = loc[0];
            } else {
                // Nếu chưa có Index, thử đợi một chút
                await this.ensureIndex();
                const retryLoc = this.getLocation(uid);
                if (retryLoc) bookId = retryLoc[0];
            }
        }
        
        if (!bookId) return null;

        const bookMeta = await MetaStore.fetch(bookId);
        if (!bookMeta || !bookMeta.meta) return null;

        const entry = bookMeta.meta[uid];
        if (entry) {
            // Inject context info (quan trọng cho breadcrumb)
            entry._book_id = bookId;
            entry._root_title = bookMeta.super_book_title || bookMeta.title;
            entry._tree = bookMeta.tree;
        }
        return entry;
    },

    /**
     * Tải danh sách Meta cho nhiều UID cùng lúc (Dùng cho Nav Buttons).
     * Tối ưu hóa bằng cách gom nhóm các UID thuộc cùng một sách.
     */
    async fetchMetaList(uids) {
        const result = {};
        const booksToFetch = new Set();
        
        // Đảm bảo index đã có để tra cứu sách
        if (!IndexStore.getAll()) await this.ensureIndex();

        // 1. Gom nhóm sách cần tải
        uids.forEach(uid => {
            const loc = this.getLocation(uid);
            if (loc) booksToFetch.add(loc[0]);
        });

        // 2. Tải song song (Parallel Fetch)
        await Promise.all(Array.from(booksToFetch).map(id => MetaStore.fetch(id)));

        // 3. Trích xuất dữ liệu từ cache
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
     * Tải toàn bộ dữ liệu để dùng Offline.
     * Sử dụng chiến thuật "Monolithic Zip" để tối ưu tốc độ.
     */
    async downloadAll(onProgress) {
        // Nếu đang ở chế độ Offline (file:// hoặc đã inject index), không cần tải
        if (AssetLoader.isOfflineMode()) {
            logger.info("DownloadAll", "Already in Offline Mode. Skipping download.");
            if (onProgress) onProgress(100, 100);
            return;
        }

        try {
            logger.info("DownloadAll", "Starting Advanced Zip Strategy...");
            // ZipImporter sẽ tải db_bundle.zip, giải nén và bơm vào Cache Storage
            await ZipImporter.run(onProgress);
            logger.info("DownloadAll", "Sync completed successfully.");
        } catch (e) {
            logger.error("DownloadAll", "Zip Strategy failed", e);
            throw e;
        }
    }
};