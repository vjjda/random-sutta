// Path: web/assets/modules/data/sutta_repository.js
import { CoreNetwork } from './core_network.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

// Cấu hình đường dẫn dữ liệu
const DB_PATH = "assets/db";

export const SuttaRepository = {
    
    async init() {
        logger.info("Init", "Repository ready.");
    },

    /**
     * [FIXED] Tính toán Bucket ID cho Split Index.
     * Thuật toán: DJB2 Hash (Unsigned 32-bit).
     * Phải khớp tuyệt đối với logic Python _get_bucket_id.
     */
    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            // hash * 33 + c
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
            // JS bitwise operators always return signed 32-bit integers
            hash = hash & 0xFFFFFFFF; 
        }
        
        // [CRITICAL FIX] Ép kiểu về Unsigned 32-bit integer bằng (>>> 0)
        // Python: 0xFFFFFFF6 -> 4294967286 (Unsigned)
        // JS cũ:  0xFFFFFFF6 -> -10 (Signed) -> Math.abs(-10) = 10 (SAI)
        // JS mới: -10 >>> 0  -> 4294967286 (Unsigned) -> Mod 20 = 6 (ĐÚNG)
        const unsignedHash = hash >>> 0;
        
        return String(unsignedHash % 20);
    },

    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();

        // 1. Offline Global Index
        if (window.__DB_INDEX__) {
            const loc = window.__DB_INDEX__[cleanUid];
            return loc || null;
        }

        // 2. Online Split Index
        const bucketId = this._getBucketId(cleanUid);
        const indexUrl = `${DB_PATH}/index/${bucketId}.json`;
        
        // Fetch bucket tương ứng
        const bucketData = await CoreNetwork.fetchJson(indexUrl);
        if (bucketData && bucketData[cleanUid]) {
            return bucketData[cleanUid];
        }

        // Nếu vẫn không thấy dù đã tính đúng bucket -> Có thể file chưa được build hoặc uid sai
        logger.warn("resolveLocation", `UID ${cleanUid} not found in bucket ${bucketId}`);
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

    async downloadAll(onProgress) {
        logger.info("Sync", "Starting Bundle Download...");
        const urlsToCache = ['assets/modules/data/constants.js'];

        try {
            const tpk = await this.fetchMeta('tpk');
            if (tpk) {
                urlsToCache.push(`${DB_PATH}/meta/tpk.json`);
                const collectBooks = (node, list) => {
                    if (typeof node === 'string') list.push(node);
                    else if (Array.isArray(node)) node.forEach(c => collectBooks(c, list));
                    else if (typeof node === 'object') Object.values(node).forEach(v => collectBooks(v, list));
                };
                const books = [];
                collectBooks(tpk.tree, books);
                
                books.forEach(bid => urlsToCache.push(`${DB_PATH}/meta/${bid}.json`));
                for (let i = 0; i < 20; i++) {
                    urlsToCache.push(`${DB_PATH}/index/${i}.json`);
                }
            }
        } catch (e) {
            logger.error("Sync", "Failed to crawl data", e);
        }

        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        await CoreNetwork.cacheBatch(urlsToCache, CACHE_NAME, onProgress);
    }
};