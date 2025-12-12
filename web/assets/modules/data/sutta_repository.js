// Path: web/assets/modules/data/sutta_repository.js
import { CoreNetwork } from './core_network.js';
import { ZipLoader } from './zip_loader.js'; // [NEW] Import Core Script
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
     * [REFACTORED] Download All Logic
     * Sử dụng ZipLoader để xử lý phần phức tạp.
     */
    async downloadAll(onProgress) {
        logger.info("Sync", "Starting Bundle Download...");
        
        // 1. Xác định Cache Name hiện tại
        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        
        // 2. Gọi Core Script để xử lý Zip
        // - URL Zip: assets/db/db_bundle.zip
        // - Path Prefix: assets/db/ (Vì trong zip là meta/mn.json, cần thành assets/db/meta/mn.json)
        await ZipLoader.importBundleToCache(
            `${DB_PATH}/db_bundle.zip`,
            CACHE_NAME,
            `${DB_PATH}/`, 
            onProgress
        );

        // 3. Cache thêm các file lẻ bên ngoài Zip (nếu cần)
        // constants.js là file quan trọng không nằm trong bundle
        const extraCache = await caches.open(CACHE_NAME);
        await extraCache.add('assets/modules/data/constants.js');
    }
};