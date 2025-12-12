// Path: web/assets/modules/data/sutta_repository.js
import { CoreNetwork } from './core_network.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");
const DB_PATH = "assets/db";

export const SuttaRepository = {
    
    async init() {
        logger.info("Init", "Repository ready.");
    },

    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
            hash = hash & 0xFFFFFFFF; 
        }
        const unsignedHash = hash >>> 0;
        return String(unsignedHash % 20);
    },

    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();

        if (window.__DB_INDEX__) {
            const loc = window.__DB_INDEX__[cleanUid];
            return loc || null;
        }

        const bucketId = this._getBucketId(cleanUid);
        const indexUrl = `${DB_PATH}/index/${bucketId}.json`;
        
        const bucketData = await CoreNetwork.fetchJson(indexUrl);
        if (bucketData && bucketData[cleanUid]) {
            return bucketData[cleanUid];
        }
        return null;
    },

    async fetchMeta(bookId) {
        if (window.__DB_LOADER__ && window.__DB_LOADER__.getMeta) {
            const memMeta = window.__DB_LOADER__.getMeta(bookId);
            if (memMeta) return memMeta;
        }
        const url = `${DB_PATH}/meta/${bookId}.json`;
        return await CoreNetwork.fetchJson(url);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const key = `${bookId}_chunk_${chunkIdx}`;
        if (window.__DB_LOADER__ && window.__DB_LOADER__.getContent) {
            const memContent = window.__DB_LOADER__.getContent(key);
            if (memContent) return memContent;
        }
        const url = `${DB_PATH}/content/${key}.json`;
        return await CoreNetwork.fetchJson(url);
    },

    async fetchMetaList(bookIds) {
        const uniqueIds = [...new Set(bookIds)];
        const results = {};
        await Promise.all(uniqueIds.map(async (bid) => {
            const meta = await this.fetchMeta(bid);
            if (meta && meta.meta) {
                Object.assign(results, meta.meta);
            }
        }));
        return results;
    },

    /**
     * [UPDATED] Sync Logic:
     * 1. Crawl TPK -> Book IDs -> Cache Meta.
     * 2. Fetch Index Buckets -> Parse Chunk IDs -> Cache Content.
     */
    async downloadAll(onProgress) {
        logger.info("Sync", "Starting Bundle Download...");
        const urlsToCache = new Set(['assets/modules/data/constants.js']);
        const uniqueChunks = new Set(); // Lưu trữ các chunk cần tải: "mn_chunk_0"

        try {
            // PHASE 1: Discovery via TPK Tree
            const tpk = await this.fetchMeta('tpk');
            if (tpk) {
                urlsToCache.add(`${DB_PATH}/meta/tpk.json`);
                
                const collectBooks = (node, list) => {
                    if (typeof node === 'string') list.push(node);
                    else if (Array.isArray(node)) node.forEach(c => collectBooks(c, list));
                    else if (typeof node === 'object') Object.values(node).forEach(v => collectBooks(v, list));
                };
                
                const books = [];
                collectBooks(tpk.tree, books);
                
                // Add Meta files
                books.forEach(bid => urlsToCache.add(`${DB_PATH}/meta/${bid}.json`));
            }

            // PHASE 2: Index & Chunk Discovery
            // Chúng ta phải fetch Index về để đọc nội dung, tìm ra các Chunk ID
            const bucketUrls = [];
            for (let i = 0; i < 20; i++) {
                bucketUrls.push(`${DB_PATH}/index/${i}.json`);
                urlsToCache.add(`${DB_PATH}/index/${i}.json`);
            }

            // Fetch song song các index để parse chunk
            await Promise.all(bucketUrls.map(async (url) => {
                const data = await CoreNetwork.fetchJson(url);
                if (data) {
                    Object.values(data).forEach(loc => {
                        // loc format: [book_id, chunk_idx]
                        if (Array.isArray(loc) && loc.length === 2 && loc[1] !== null) {
                            const [bookId, chunkIdx] = loc;
                            uniqueChunks.add(`${bookId}_chunk_${chunkIdx}`);
                        }
                    });
                }
            }));

            // Add Content files to cache list
            uniqueChunks.forEach(chunkName => {
                urlsToCache.add(`${DB_PATH}/content/${chunkName}.json`);
            });

            logger.info("Sync", `Discovered ${urlsToCache.size} files to cache.`);

        } catch (e) {
            logger.error("Sync", "Failed to crawl data", e);
            throw e; // Ném lỗi để UI hiển thị trạng thái Error
        }

        // PHASE 3: Batch Caching
        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        await CoreNetwork.cacheBatch(Array.from(urlsToCache), CACHE_NAME, onProgress);
    }
};