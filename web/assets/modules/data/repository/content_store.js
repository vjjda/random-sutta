// Path: web/assets/modules/data/repository/content_store.js
import { AssetLoader } from '../loader/asset_loader.js';

const cache = new Map();

export const ContentStore = {
    async fetchChunk(bookId, chunkIdx) {
        // Key khớp với tên file: an1_chunk_0
        const cacheKey = `${bookId}_chunk_${chunkIdx}`;
        
        if (cache.has(cacheKey)) return cache.get(cacheKey);

        const data = await AssetLoader.load(cacheKey, `content/${cacheKey}`);
        
        if (data) {
            cache.set(cacheKey, data);
        }
        return data;
    }
};