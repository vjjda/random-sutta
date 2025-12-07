// Path: web/assets/modules/data/sutta_repository.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaRepository");

// Cache memory để tránh request lại file chunk/structure đã tải
const _cache = {
    index: null,      // uid_index.json
    chunks: {},       // content/xxx_chunk_1.json
    structures: {}    // structure/xxx_struct.json
};

export const SuttaRepository = {
    async init() {
        if (_cache.index) return;
        try {
            // Tải Master Index
            const resp = await fetch('assets/db/uid_index.json');
            if (!resp.ok) throw new Error("Could not load uid_index.json");
            _cache.index = await resp.json();
            logger.info("init", "DB Index loaded");
        } catch (e) {
            logger.error("init", "Failed to init repository", e);
            throw e;
        }
    },

    /**
     * Tìm vị trí file chứa UID
     */
    _resolveLocator(uid) {
        if (!_cache.index || !_cache.index.locator) return null;
        return _cache.index.locator[uid]; // VD: "content/sutta_an_an_chunk_1"
    },

    /**
     * Tải file JSON từ server (hoặc cache)
     */
    async _fetchJson(relativePath) {
        const fullPath = `assets/db/${relativePath}.json`;
        
        // Check cache chunks/structures
        if (relativePath.startsWith('content/') && _cache.chunks[relativePath]) {
            return _cache.chunks[relativePath];
        }
        if (relativePath.startsWith('structure/') && _cache.structures[relativePath]) {
            return _cache.structures[relativePath];
        }

        logger.debug("fetch", `Fetching ${relativePath}...`);
        const resp = await fetch(fullPath);
        if (!resp.ok) return null;
        
        const data = await resp.json();

        // Save to cache
        if (relativePath.startsWith('content/')) _cache.chunks[relativePath] = data;
        if (relativePath.startsWith('structure/')) _cache.structures[relativePath] = data;

        return data;
    },

    /**
     * Lấy dữ liệu thô của một Entry (Leaf hoặc Subleaf) từ Chunk.
     * Lưu ý: Hàm này trả về object trong chunk, có thể chỉ có meta (nếu là subleaf).
     */
    async getSuttaEntry(uid) {
        await this.init();
        const locator = this._resolveLocator(uid);
        if (!locator) {
            logger.warn("getSuttaEntry", `UID ${uid} not found in index.`);
            return null;
        }

        // Locator dạng "content/filename" -> Tải chunk
        const chunkData = await this._fetchJson(locator);
        if (!chunkData || !chunkData[uid]) return null;

        return chunkData[uid]; // Trả về entry: { content: ..., meta: ... } hoặc { meta: ... }
    },

    /**
     * Lấy Structure của một sách
     */
    async getBookStructure(bookId) {
        // Locator cho structure thường là structure/sutta_{book}_struct
        // Tuy nhiên index locator lưu theo UID. Ta có thể đoán path hoặc lookup root uid.
        // Cách an toàn: Giả sử bookId là 'an' -> 'structure/sutta_an_an_struct'
        // (Cần logic mapping chuẩn hơn nếu tên file phức tạp, nhưng tạm thời dùng convention này)
        
        // Hack: Tìm locator của uid đầu tiên của sách (VD: dn1) để biết file struct?
        // Đơn giản hơn: Build process của bạn đã lưu locator cho các ROOT UID (dn, mn...)
        await this.init();
        const locator = this._resolveLocator(bookId); // VD: locator['an']
        if (!locator) return null;

        return await this._fetchJson(locator);
    }
};