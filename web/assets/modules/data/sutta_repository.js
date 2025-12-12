// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("Repository");

// Cache memory (cho session hiện tại)
const _cache = new Map();
// Pending requests (để tránh duplicate request khi gọi dồn dập)
const _pending = new Map();

/**
 * PHÁT HIỆN CHẾ ĐỘ OFFLINE (QUAN TRỌNG)
 * 1. Chạy qua giao thức file:// (Rõ ràng là offline)
 * 2. HOẶC có biến global __DB_INDEX__ (Biến này chỉ được inject vào index.html trong quá trình build offline)
 * * Logic này giúp phân biệt bản "Dev-Online" (chạy port 8001) và "Dev-Offline" (chạy port 8002) 
 * ngay cả khi cả hai đều đang chạy trên localhost (http).
 */
const IS_OFFLINE_BUILD = window.location.protocol === 'file:' || !!window.__DB_INDEX__;

export const SuttaRepository = {
    async init() {
        // Setup DB Loader cho chế độ Offline (Cơ chế JSONP/Callback)
        // Các file .js trong db/meta và db/content sẽ gọi hàm này khi load xong.
        if (!window.__DB_LOADER__) {
            window.__DB_LOADER__ = {
                resolvers: {},
                receive: function(key, data) {
                    // Nếu có promise đang chờ (được tạo bởi _loadScript), hãy resolve nó
                    if (this.resolvers[key]) {
                        this.resolvers[key](data);
                        delete this.resolvers[key];
                    } else {
                        // Trường hợp script load xong quá nhanh hoặc được preload
                        _cache.set(key, data);
                    }
                }
            };
        }
    },

    async fetchMeta(bookId) {
        return this._loadData('meta', bookId);
    },

    async fetchContentChunk(bookId, chunkIdx) {
        const key = `${bookId}_chunk_${chunkIdx}`;
        return this._loadData('content', key);
    },

    async fetchMetaList(bookIds) {
        const results = {};
        await Promise.all(bookIds.map(async (id) => {
            const data = await this.fetchMeta(id);
            if (data) results[id] = data;
        }));
        return results;
    },

    // --- Core Loading Logic (The Brain) ---

    async _loadData(category, key) {
        // 1. Kiểm tra Cache Memory
        if (_cache.has(key)) return _cache.get(key);
        
        // 2. Kiểm tra Request đang chạy (Deduplication)
        if (_pending.has(key)) return _pending.get(key);

        const promise = new Promise(async (resolve, reject) => {
            try {
                // [DECISION POINT] Rẽ nhánh dựa trên môi trường
                if (IS_OFFLINE_BUILD) {
                    // Môi trường Offline (File hoặc Server Offline): Load file .js
                    await this._loadScript(category, key, resolve, reject);
                } else {
                    // Môi trường Online (Web hoặc Server Online): Fetch file .json
                    await this._fetchJson(category, key, resolve, reject);
                }
            } catch (e) {
                reject(e);
            }
        });

        _pending.set(key, promise);
        
        try {
            const result = await promise;
            _cache.set(key, result);
            _pending.delete(key);
            return result;
        } catch (e) {
            _pending.delete(key);
            logger.warn("_loadData", `Failed to load ${category}/${key}: ${e.message}`);
            return null;
        }
    },

    // --- STRATEGY 1: ONLINE (Fetch JSON) ---
    async _fetchJson(category, key, resolve, reject) {
        const url = `assets/db/${category}/${key}.json`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            resolve(data);
        } catch (e) {
            reject(e);
        }
    },

    // --- STRATEGY 2: OFFLINE (Script Injection) ---
    _loadScript(category, key, resolve, reject) {
        // Đăng ký resolver để window.__DB_LOADER__ gọi lại
        window.__DB_LOADER__.resolvers[key] = resolve;

        const script = document.createElement('script');
        // Lưu ý: Bản offline dùng file .js thay vì .json
        script.src = `assets/db/${category}/${key}.js`;
        script.async = true;
        
        script.onerror = (e) => {
            delete window.__DB_LOADER__.resolvers[key];
            reject(new Error(`Script load error: ${script.src}`));
            script.remove();
        };

        script.onload = () => {
            script.remove(); // Dọn dẹp DOM sau khi chạy xong
            // Resolve sẽ được gọi từ bên trong file JS (qua window.__DB_LOADER__.receive)
        };

        document.body.appendChild(script);
    },

    // --- Location Resolver (Split Index Support) ---
    
    async resolveLocation(uid) {
        // 1. Ưu tiên: Check Offline Index (Memory Object)
        // Bản Offline Build sẽ có biến này ngay từ đầu
        if (window.__DB_INDEX__) {
            const loc = window.__DB_INDEX__[uid];
            return loc ? loc : null;
        }

        // 2. Check Online Split Index (Lazy Fetch)
        // Bản Online không tải index khổng lồ mà dùng Hash để tải từng mảnh nhỏ
        const bucketId = this._getBucketId(uid);
        const indexKey = `index_${bucketId}`;
        
        let bucketData = _cache.get(indexKey);
        
        if (!bucketData) {
            try {
                // Fetch bucket index file (ví dụ: assets/db/index/5.json)
                const response = await fetch(`assets/db/index/${bucketId}.json`);
                if (response.ok) {
                    bucketData = await response.json();
                    _cache.set(indexKey, bucketData);
                }
            } catch (e) {
                // Silent fail (có thể do mạng hoặc file không tồn tại)
                logger.debug("Resolve", `Bucket ${bucketId} not found`);
            }
        }

        if (bucketData && bucketData[uid]) {
            return bucketData[uid];
        }

        return null;
    },

    // Hàm băm nhất quán (Consistent Hashing) khớp với Python Generator
    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
            // Force 32-bit integer để khớp hành vi Python/C
            hash = hash & 0xFFFFFFFF;
        }
        return Math.abs(hash % 20).toString();
    },

    // --- Feature: Download Offline (Cho bản Online) ---
    /**
     * Tải file zip lớn, giải nén và lưu vào Cache Storage.
     * Giúp bản Online có thể hoạt động offline sau đó.
     */
    async downloadAll(onProgress) {
        if (IS_OFFLINE_BUILD) {
            logger.info("Download", "Already in offline build mode.");
            if (onProgress) onProgress(100, 100);
            return;
        }

        if (!window.JSZip) {
            throw new Error("JSZip library not loaded");
        }

        logger.info("Download", "Fetching db_bundle.zip...");
        const response = await fetch('assets/db/db_bundle.zip');
        if (!response.ok) throw new Error("Failed to fetch bundle");

        const blob = await response.blob();
        
        // Load zip
        const zip = await window.JSZip.loadAsync(blob);
        const files = Object.keys(zip.files);
        const total = files.length;
        let processed = 0;

        // Tìm Cache Storage của App
        const keys = await caches.keys();
        const cacheName = keys.find(k => k.startsWith("sutta-cache-"));
        if (!cacheName) throw new Error("No active cache found");
        
        const cache = await caches.open(cacheName);
        logger.info("Download", `Unzipping to cache: ${cacheName}`);

        // Process từng file trong zip
        // Dùng Promise.all với batch size để tối ưu hiệu năng
        const BATCH_SIZE = 10;
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (filename) => {
                const file = zip.files[filename];
                if (file.dir) return;

                // Đọc nội dung file từ zip
                // Lưu ý: File trong zip là JSON thuần, ta cần tạo Response object
                const content = await file.async("string");
                
                // Tạo Request ảo (đường dẫn tương ứng assets/db/...)
                // Zip chứa cấu trúc: meta/mn.json, content/mn_chunk_0.json
                const url = `assets/db/${filename}`;
                const request = new Request(url);
                
                const response = new Response(content, {
                    headers: { "Content-Type": "application/json" }
                });

                // Lưu vào Cache Storage
                await cache.put(request, response);
                
                processed++;
            }));

            if (onProgress) onProgress(processed, total);
        }
        
        logger.info("Download", "Bundle installation complete.");
    }
};