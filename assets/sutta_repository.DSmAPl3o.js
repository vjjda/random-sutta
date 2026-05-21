// Path: web/assets/modules/data/sutta_repository.js
import { SuttaDB } from './sutta_db.js';
import { getLogger } from 'utils/logger.js';
import { DictProvider } from 'lookup/dict_provider.js';

const logger = getLogger("SuttaRepository");

export const SuttaRepository = {
    
    async init() {
        await SuttaDB.init();
    },

    /**
     * Xác định shard (category) dựa trên bookId
     */
    _getCategory(bookId) {
        if (!bookId) return "minor";
        const b = bookId.toLowerCase();

        // Pali Shards - Priority 0 (Primary)
        if (['dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig'].includes(b)) return "major";
        
        if (b.startsWith('pli-tv-')) return "vinaya";
        if (['ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana'].includes(b)) return "abhidhamma";

        // Lzh Shards
        if (['sa', 'ma', 'da', 'ea', 'sa-2', 'sa-3', 'sa-ot', 'ma-ot', 'da-ot', 'ea-2', 'ea-ot'].includes(b)) return "lzh_major";
        if (['lzh-dk', 'sag', 'sg', 'sab'].includes(b)) return "lzh_abhidhamma";
        if (b.startsWith('lzh-dg')) return "lzh_vinaya_dg";
        if (b.startsWith('lzh-mg')) return "lzh_vinaya_mg";
        if (b.startsWith('lzh-sarv')) return "lzh_vinaya_sarv";
        if (b.startsWith('lzh-mi') || b.startsWith('lzh-mu') || b.startsWith('lzh-ka')) return "lzh_vinaya_other";
        if (b.startsWith('lzh-') || ['t210', 't211', 't212', 't213'].includes(b)) return "lzh_minor";

        return "minor";
    },

    async resolveLocation(uid) {
        if (!uid) return null;
        const cleanUid = uid.toLowerCase().trim();
        const results = await SuttaDB.query("SELECT book_id, uid FROM metadata WHERE uid = ?", [cleanUid]);
        if (results.length > 0) {
            return [results[0].book_id, results[0].uid];
        }
        return null;
    },

    async searchMetadata(query, limit = 30) {
        if (!query || query.length < 2) return [];
        
        // 1. Prepare FTS query
        const cleanQuery = query.replace(/[.*"':]/g, " ").trim();
        if (!cleanQuery) return [];
        
        const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
        const normalizedQuery = cleanQuery.replace(/\s/g, "");
        const ftsQuery = `("${cleanQuery}" OR (${terms.map(t => `${t}*`).join(' AND ')}) OR "${normalizedQuery}*")`;

        try {
            // 2. Query Search DB (FTS5) to get UIDs and snippets
            // Note: snippet() is called on the FTS table itself
            const searchSql = `
                SELECT 
                    uid, 
                    snippet(metadata_fts, -1, '<b>', '</b>', '...', 25) as snippet,
                    rank
                FROM metadata_fts 
                WHERE metadata_fts MATCH ? 
                LIMIT ?
            `;
            
            const searchResults = await SuttaDB.querySearch(searchSql, [ftsQuery, limit * 2]);
            if (!searchResults || searchResults.length === 0) return [];

            const uids = searchResults.map(r => r.uid);
            const snippetMap = Object.fromEntries(searchResults.map(r => [r.uid, r.snippet]));
            const rankMap = Object.fromEntries(searchResults.map(r => [r.uid, r.rank]));

            // 3. Query Core DB to get full metadata details for these UIDs
            const phrase = cleanQuery.toLowerCase();
            const acronymSearch = `%${phrase}%`;
            const placeholders = uids.map(() => '?').join(',');

            const coreSql = `
                SELECT 
                    m.uid, m.type, m.target_uid, m.parent_uid, m.hash_id, m.search_priority,
                    m.original_title, m.translated_title, m.blurb, m.acronym,
                    t.original_title as target_original_title, t.translated_title as target_translated_title, t.blurb as target_blurb,
                    p.original_title as parent_original_title, p.translated_title as parent_translated_title, p.blurb as parent_blurb,
                    (CASE 
                        WHEN m.uid = ? THEN 0
                        WHEN m.acronym LIKE ? THEN 1
                        WHEN (m.original_title LIKE '%' || ? || '%' OR m.translated_title LIKE '%' || ? || '%' OR m.blurb LIKE '%' || ? || '%') THEN 2
                        ELSE 3
                    END) as match_priority
                FROM metadata m
                LEFT JOIN metadata t ON m.target_uid = t.uid
                LEFT JOIN metadata p ON m.parent_uid = p.uid
                WHERE m.uid IN (${placeholders})
            `;

            const params = [
                normalizedQuery.toLowerCase(), 
                acronymSearch,
                phrase, phrase, phrase,
                ...uids
            ];

            const detailedResults = await SuttaDB.query(coreSql, params);

            // 4. Merge results and sort by priority + original FTS rank
            return detailedResults.map(m => ({
                ...m,
                snippet: snippetMap[m.uid] || "",
                rank: rankMap[m.uid] || 0
            })).sort((a, b) => {
                if (a.match_priority !== b.match_priority) return a.match_priority - b.match_priority;
                if (a.search_priority !== b.search_priority) return a.search_priority - b.search_priority;
                return a.rank - b.rank;
            }).slice(0, limit);

        } catch (e) {
            logger.error("Search", "Hybrid search failed", e);
            return [];
        }
    },

    async fetchMeta(bookId) {
        // Query Metadata từ Core DB
        const metaResults = await SuttaDB.query("SELECT * FROM metadata WHERE book_id = ?", [bookId]);
        if (metaResults.length === 0) return null;
        
        const meta = {};
        let rootTitle = "";
        
        for (const r of metaResults) {
            meta[r.uid] = {
                type: r.type,
                root_lang: r.root_lang,
                acronym: r.acronym,
                translated_title: r.translated_title,
                original_title: r.original_title,
                blurb: r.blurb,
                author_uid: r.author_uid,
                parent_uid: r.parent_uid,
                target_uid: r.target_uid,
                children: r.children ? JSON.parse(r.children) : [],
                hash_id: r.hash_id,
                extract_id: r.extract_id,
                nav: { prev: r.nav_prev, next: r.nav_next }
            };
            if (r.uid === bookId) {
                rootTitle = r.translated_title || r.original_title || r.acronym;
            }
        }
        
        const structResults = await SuttaDB.query("SELECT tree_json FROM structure WHERE book_id = ?", [bookId]);
        let tree = {};
        if (structResults.length > 0) {
            tree = JSON.parse(structResults[0].tree_json);
        }
        
        return {
            meta: meta,
            tree: tree,
            title: rootTitle || bookId,
            super_book_title: rootTitle || bookId
        };
    },

    /**
     * Cache cho author_priority để tránh query liên tục
     */
    _authorPriority: null,

    async _getAuthorPriority() {
        if (this._authorPriority) return this._authorPriority;

        try {
            const results = await SuttaDB.query("SELECT value FROM config WHERE key = 'author_priority'");
            if (results.length > 0) {
                this._authorPriority = JSON.parse(results[0].value);
                return this._authorPriority;
            }
        } catch (e) {
            logger.error("Failed to fetch author_priority", e);
        }
        return [];
    },

    async fetchContent(uid) {
        if (!uid) return null;

        // 1. Tìm book_id để biết nạp shard nào
        const loc = await this.resolveLocation(uid);
        if (!loc) return null;

        const [bookId] = loc;
        const category = this._getCategory(bookId);
        const priorityList = await this._getAuthorPriority();

        // 2. Query từ Content Shard tương ứng (Vertical Schema)
        const sql = "SELECT segment_id, type, lang, author_uid, content FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order";
        const results = await SuttaDB.queryShard(category, sql, [uid]);

        if (results.length === 0) return null;

        const contentMap = {};
        // Lưu trữ tạm thời để so sánh độ ưu tiên: { segId: { author: 'sujato', score: 0, content: '...' } }
        const transTemp = {};

        for (const row of results) {
            const segId = row.segment_id;
            if (!contentMap[segId]) {
                contentMap[segId] = {};
            }

            const type = row.type;
            const author = row.author_uid;

            if (type === 'root') {
                contentMap[segId].pli = row.content;
                contentMap[segId].root_lang = row.lang;
            } else if (type === 'html') {
                contentMap[segId].html = row.content;
            } else if (type === 'comment') {
                contentMap[segId].comm = row.content;
            } else if (type === 'variant') {
                contentMap[segId].variant = row.content;
            } else if (type === 'reference') {
                contentMap[segId].reference = row.content;
            } else if (type === 'translation') {
                // Logic xử lý ưu tiên bản dịch
                const currentScore = priorityList.indexOf(author);
                const bestScoreSoFar = transTemp[segId] ? priorityList.indexOf(transTemp[segId].author) : 999;

                // Nếu author này có trong list và có điểm ưu tiên cao hơn (index thấp hơn)
                // Hoặc nếu chưa có bản dịch nào cho segment này
                if (currentScore !== -1 && (currentScore < (bestScoreSoFar === -1 ? 999 : bestScoreSoFar) || !transTemp[segId])) {
                    transTemp[segId] = { author: author, content: row.content };
                    contentMap[segId].eng = row.content;
                } else if (!transTemp[segId]) {
                    // Fallback nếu không có author nào trong list priority, lấy đại cái đầu tiên
                    transTemp[segId] = { author: author, content: row.content };
                    contentMap[segId].eng = row.content;
                }
            }
        }
        return contentMap;
    },

    async fetchMetaList(uids) {
        const uniqueIds = [...new Set(uids)].filter(id => id);
        if (uniqueIds.length === 0) return {};
        
        const placeholders = uniqueIds.map(() => '?').join(',');
        const metaResults = await SuttaDB.query(`SELECT * FROM metadata WHERE uid IN (${placeholders})`, uniqueIds);
        
        const results = {};
        for (const r of metaResults) {
            results[r.uid] = {
                type: r.type,
                root_lang: r.root_lang,
                acronym: r.acronym,
                translated_title: r.translated_title,
                original_title: r.original_title,
                blurb: r.blurb,
                author_uid: r.author_uid,
                parent_uid: r.parent_uid,
                target_uid: r.target_uid,
                children: r.children ? JSON.parse(r.children) : [],
                hash_id: r.hash_id,
                extract_id: r.extract_id,
                nav: { prev: r.nav_prev, next: r.nav_next }
            };
        }
        
        return results;
    },

    /**
     * Get parallel relationships for a given sutta UID.
     * Automatically fallbacks to parent parallels if the UID is a subleaf.
     * @param {string} uid Sutta UID
     * @returns {Promise<Object|null>} Parallels JSON object or null if not found
     */
    async getParallels(uid) {
        if (!uid) return null;
        
        try {
            // 1. Try direct lookup from dedicated Parallels DB
            let results = await SuttaDB.queryParallels("SELECT relations FROM parallels WHERE src_uid = ?", [uid]);
            if (results && results.length > 0) {
                return JSON.parse(results[0].relations);
            }

            // 2. [FALLBACK] If not found, check if it's a subleaf and try parent
            const metaResults = await SuttaDB.query("SELECT parent_uid FROM metadata WHERE uid = ? AND type = 'subleaf'", [uid]);
            if (metaResults && metaResults.length > 0) {
                const parentUid = metaResults[0].parent_uid;
                logger.debug('getParallels', `Falling back to parent parallels: ${parentUid} for subleaf ${uid}`);
                results = await SuttaDB.queryParallels("SELECT relations FROM parallels WHERE src_uid = ?", [parentUid]);
                if (results && results.length > 0) {
                    const data = JSON.parse(results[0].relations);
                    // Add mapping info to help frontend identify the original parent key
                    data._parentUid = parentUid;
                    return data;
                }
            }
            
            return null;
        } catch (error) {
            logger.error('getParallels', `Error fetching parallels for ${uid}`, error);
            return null;
        }
    },

    /**
     * Kiểm tra nhanh xem bài kinh có bản song hành không sử dụng flag trong metadata
     */
    async checkParallelsExistence(uid) {
        if (!uid) return false;
        
        // Check direct UID and parent if it's a subleaf
        const results = await SuttaDB.query(`
            SELECT has_parallels FROM metadata 
            WHERE uid = ? 
            OR uid = (SELECT parent_uid FROM metadata WHERE uid = ? AND type = 'subleaf')
        `, [uid, uid]);
        
        return results.some(r => r.has_parallels === 1);
    },

    async downloadAll(onProgress) {
        // 1. Nạp Core Database (Metadata, Structure)
        await SuttaDB.init((loaded, total) => {
             if (onProgress) onProgress(loaded, total * 7); // 1 core + 1 parallels + 4 shards + 1 dict = 7
        });
        
        // 2. Nạp Parallels Database
        try {
            await SuttaDB.loadParallels((loaded, total) => {
                 if (onProgress) onProgress(loaded + total, total * 7);
            });
            logger.info("DownloadAll", "✅ Parallels cached.");
        } catch (e) {
            logger.warn("DownloadAll", "Failed to cache parallels", e);
        }

        // 3. Nạp từ điển (DPD) để Safari cache lại
        try {
            await DictProvider.init();
            logger.info("DownloadAll", "✅ Dictionary cached.");
            // Tối ưu RAM: Đóng ngay sau khi cache xong
            await DictProvider.closeAll();
        } catch (e) {
            logger.warn("DownloadAll", "Failed to cache dictionary", e);
        }

        // 4. Nạp tất cả Shard nội dung đồng thời để Safari cache lại qua SW
        const shards = ['major', 'minor', 'vinaya', 'abhidhamma', 'lzh_major', 'lzh_abhidhamma', 'lzh_vinaya_dg', 'lzh_vinaya_mg', 'lzh_vinaya_sarv', 'lzh_vinaya_other', 'lzh_minor'];
        let shardCount = 0;
        
        logger.info("DownloadAll", "Fetching all content shards for offline use...");

        // [OFFLINE FIX] Load sequentially and prefetch without keeping connection open to prevent iOS out-of-memory crashes
        for (const category of shards) {
             await SuttaDB.prefetchShard(category, (loaded, total) => {
                 const base = (shardCount + 2) * 8; // Adjust based on total shards
                 if (onProgress) onProgress(base, 100);
             });
             shardCount++;
        }

        logger.info("DownloadAll", "✅ All shards cached for offline.");
    }
};
