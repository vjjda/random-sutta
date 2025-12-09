// Path: web/assets/modules/data/index_resolver.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("IndexResolver");

export const IndexResolver = {
    _buckets: {}, // Cache memory cho các bucket đã load

    /**
     * Thuật toán Hash DJB2 - PHẢI KHỚP với Python orchestrator.py
     * Python: hash_val = ((hash_val << 5) + hash_val) + ord(char)
     */
    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
            hash = hash & 0xFFFFFFFF; // Force 32-bit integer (JS specific)
        }
        // Python dùng % 20. JS hash có thể âm, nên cần xử lý abs
        return Math.abs(hash % 20).toString();
    },

    /**
     * Trả về vị trí của UID: { book_id, chunk_idx }
     */
    async resolve(uid) {
        // 1. Chế độ Offline cứng (File Protocol hoặc đã inject index)
        // Biến __DB_INDEX__ được tạo bởi offline_converter.py
        if (window.__DB_INDEX__) {
            return window.__DB_INDEX__[uid] || null;
        }

        // 2. Chế độ Online (Lazy Load Split Index)
        const bucketId = this._getBucketId(uid);
        
        // Nếu chưa có trong RAM, tải file index nhỏ (~20KB) về
        if (!this._buckets[bucketId]) {
            try {
                const res = await fetch(`assets/db/index/${bucketId}.json`);
                if (res.ok) {
                    this._buckets[bucketId] = await res.json();
                } else {
                    this._buckets[bucketId] = {}; // Đánh dấu đã tải nhưng rỗng
                }
            } catch (e) {
                logger.warn("resolve", `Failed to load index bucket ${bucketId}`);
                return null;
            }
        }

        return this._buckets[bucketId][uid] || null;
    }
};