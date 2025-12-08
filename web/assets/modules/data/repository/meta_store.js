// Path: web/assets/modules/data/repository/meta_store.js
import { AssetLoader } from '../loader/asset_loader.js';

// Cache In-Memory để tránh tải lại
const cache = new Map();

export const MetaStore = {
    async fetch(bookId) {
        if (cache.has(bookId)) return cache.get(bookId);

        // Key = bookId (vd: an1), Path = meta/an1
        const data = await AssetLoader.load(bookId, `meta/${bookId}`);
        
        if (data) {
            cache.set(bookId, data);
        }
        return data;
    },

    getCachedEntry(bookId, uid) {
        const bookData = cache.get(bookId);
        return bookData?.meta?.[uid] || null;
    }
};