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
     * [FIXED] Sync Logic (Zip Strategy):
     * 1. Download `db_bundle.zip` (One Request).
     * 2. Unzip using JSZip.
     * 3. Put all files into Cache Storage.
     */
    async downloadAll(onProgress) {
        logger.info("Sync", "Starting Bundle Download...");
        
        // 1. Kiểm tra JSZip
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library not loaded");
        }

        // 2. Tải file Zip
        const zipUrl = `${DB_PATH}/db_bundle.zip`;
        const response = await fetch(zipUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to download bundle: ${response.status}`);
        }

        const blob = await response.blob();
        
        // 3. Giải nén
        logger.info("Sync", "Unzipping bundle...");
        const zip = await JSZip.loadAsync(blob);
        const files = Object.keys(zip.files).filter(filename => !zip.files[filename].dir);
        
        const total = files.length;
        let processed = 0;

        // 4. Mở Cache
        const CACHE_NAME = (await caches.keys()).find(k => k.startsWith('sutta-cache-')) || 'sutta-cache-temp';
        const cache = await caches.open(CACHE_NAME);

        // 5. Lưu từng file vào Cache
        // Chia nhỏ batch để không làm đơ UI (Chunk size = 20 file)
        const batchSize = 20;
        
        for (let i = 0; i < total; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (filename) => {
                const fileData = await zip.file(filename).async("string"); // JSON content
                
                // Tạo Response giả lập để lưu vào Cache
                const mockResponse = new Response(fileData, {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                    statusText: 'OK'
                });

                // Đường dẫn lưu cache phải khớp với đường dẫn fetch thực tế
                // Zip structure: "meta/mn.json" -> URL: "assets/db/meta/mn.json"
                const cacheUrl = `${DB_PATH}/${filename}`;
                await cache.put(cacheUrl, mockResponse);
            }));

            processed += batch.length;
            if (onProgress) onProgress(Math.min(processed, total), total);
        }
        
        // Cache thêm constants.js (nằm ngoài zip) để đảm bảo shell
        await cache.add('assets/modules/data/constants.js');

        logger.info("Sync", `Successfully cached ${total} files from bundle.`);
    }
};