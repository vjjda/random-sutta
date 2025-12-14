// Path: web/assets/modules/data/index_resolver.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("IndexResolver");

export const IndexResolver = {
    _buckets: {}, 

    _getBucketId(uid) {
        let hash = 5381;
        for (let i = 0; i < uid.length; i++) {
            hash = ((hash << 5) + hash) + uid.charCodeAt(i);
        }
        // [FIX] Sử dụng '>>> 0' để ép kiểu sang Unsigned 32-bit Integer
        // Điều này đảm bảo khớp với logic Python (hash &= 0xFFFFFFFF)
        // Python: 4294967295 % 20 = 15
        // JS cũ: Math.abs(-1 % 20) = 1 (SAI)
        // JS mới: (4294967295 % 20) = 15 (ĐÚNG)
        return ((hash >>> 0) % 20).toString();
    },

    async resolve(uid) {
        if (window.__DB_INDEX__) {
            return window.__DB_INDEX__[uid] || null;
        }

        const bucketId = this._getBucketId(uid);
        
        if (!this._buckets[bucketId]) {
            try {
                const res = await fetch(`assets/db/index/${bucketId}.json`);
                if (res.ok) {
                    this._buckets[bucketId] = await res.json();
                } else {
                    this._buckets[bucketId] = {};
                }
            } catch (e) {
                logger.warn("resolve", `Failed to load bucket ${bucketId}`);
                return null;
            }
        }

        return this._buckets[bucketId][uid] || null;
    }
};