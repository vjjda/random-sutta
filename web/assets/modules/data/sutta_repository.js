// Path: web/assets/modules/data/sutta_repository.js
import { CoreNetwork } from './core_network.js';
import { ZipLoader } from './zip_loader.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");
const DB_PATH = "assets/db";

// Buffer tạm để hứng dữ liệu từ các file .js (JSONP)
const dataBuffer = {};

// Setup Global Loader để các file .js gọi vào
window.__DB_LOADER__ = {
    receive: (key, data) => {
        // key ví dụ: "mn_chunk_0"
        dataBuffer[key] = data;
    },
    // Các hàm getter cũ (nếu cần tương thích ngược)
    getMeta: (id) => null,
    getContent: (id) => null
};

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
        return String((hash >>> 0) % 20);
    },

    // --- STRATEGY SWITCHER ---
    // Kiểm tra xem có đang ở chế độ Offline Build (có index global) không
    _isOfflineBuild() {
        return !!window.__DB_INDEX__;
    },

    async _loadData(category, filenameWithoutExt) {
        // 1. Nếu là Offline Build -> Load file .js
        if (this._isOfflineBuild()) {
            // Check buffer xem có sẵn chưa
            if (dataBuffer[filenameWithoutExt]) {
                return dataBuffer[filenameWithoutExt];
            }

            // Load script: assets/db/content/mn_chunk_0.js
            const scriptUrl = `${DB_PATH}/${category}/${filenameWithoutExt}.js`;
            try {
                await CoreNetwork.loadScript(scriptUrl);
                // Sau khi load xong, script sẽ tự gọi __DB_LOADER__.receive để đẩy data vào buffer
                const data = dataBuffer[filenameWithoutExt];
                if (data) return data;
                throw new Error("Data not found in buffer after script load");
            } catch (e) {
                logger.error("LoadData", `Failed to load JS: ${scriptUrl}`, e);
                return null;
            }
        } 
        
        // 2. Nếu là Online / Dev Server -> Fetch file .json
        else {
            const jsonUrl = `${DB_PATH}/${category}/${filenameWithoutExt}.json`;
            return await CoreNetwork.fetchJson(jsonUrl);
        }
    },

    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();

        // Ưu tiên Global Index (Offline Build)
        if (window.__DB_INDEX__) {
            const loc = window.__DB_INDEX__[cleanUid];
            return loc || null;
        }

        // Online Split Index
        const bucketId = this._getBucketId(cleanUid);
        const indexUrl = `${DB_PATH}/index/${bucketId}.json`;
        
        const bucketData = await CoreNetwork.fetchJson(indexUrl);
        if (bucketData && bucketData[cleanUid]) {
            return bucketData[cleanUid];
        }
        return null;
    },

    async fetchMeta(bookId) {
        // Tự động chọn chiến lược .js hay .json
        return await this._loadData("meta", bookId);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const filename = `${bookId}_chunk_${chunkIdx}`;
        return await this._loadData("content", filename);
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
        // ... (Giữ nguyên logic download bundle zip cho bản Online)
        // ...
        // Logic ZipLoader...
        logger.info("Sync", "Starting Bundle Download...");
        // Kiểm tra JSZip...
        if (typeof JSZip === 'undefined') throw new Error("JSZip missing");
        
        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        await ZipLoader.importBundleToCache(`${DB_PATH}/db_bundle.zip`, CACHE_NAME, `${DB_PATH}/`, onProgress);
        
        const extraCache = await caches.open(CACHE_NAME);
        await extraCache.add('assets/modules/data/constants.js');
    }
};