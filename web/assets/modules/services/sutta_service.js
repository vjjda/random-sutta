// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js';
import { StructureStrategy } from './structure_strategy.js';

const logger = getLogger("SuttaService");

// [PERFORMANCE] Biến lưu cache trên RAM cho dữ liệu tĩnh dùng chung
let _tpkCache = null;

// [NEW] Helper: Tìm node trong cây cấu trúc dựa trên UID
function findNodeInTree(structure, targetId) {
    if (!structure) return null;
    if (Array.isArray(structure)) {
        for (const child of structure) {
            if (typeof child === 'string') {
                if (child === targetId) return "LEAF";
            } else {
                const res = findNodeInTree(child, targetId);
                if (res) return res;
            }
        }
        return null;
    }
    if (typeof structure === 'object') {
        if (structure[targetId]) return structure[targetId];
        for (const key in structure) {
            const res = findNodeInTree(structure[key], targetId);
            if (res) return res;
        }
    }
    return null;
}

// [NEW] Helper: Xác định xem node này có phải là Single Chain không
function getSingleChildTarget(nodeContent) {
    if (!nodeContent || nodeContent === "LEAF") return null;
    if (Array.isArray(nodeContent) && nodeContent.length === 1) {
        const child = nodeContent[0];
        if (typeof child === 'string') return child;
        if (typeof child === 'object') {
            const keys = Object.keys(child);
            if (keys.length === 1) return keys[0];
        }
    }
    
    if (typeof nodeContent === 'object' && !Array.isArray(nodeContent)) {
        const keys = Object.keys(nodeContent);
        if (keys.length === 1) {
             const childVal = nodeContent[keys[0]];
             return getSingleChildTarget(childVal) ? keys[0] : null; 
        }
    }

    return null;
}

export const SuttaService = {
    async init() {
        await SuttaRepository.init();
        RandomHelper.init(); 
    },

    async loadSutta(input, options = { prefetchNav: true }) {
        let uid, hintChunk = null, hintBook = null;
        if (typeof input === 'object') {
            uid = input.uid;
            hintChunk = input.chunk || null;
            hintBook = input.book_id || null;
        } else {
            uid = input;
        }

        if (hintBook === null || hintChunk === null) {
            let loc = await SuttaRepository.resolveLocation(uid);
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        // --- ENVIRONMENT CHECK ---
        const isFileProtocol = window.location.protocol === 'file:';
        const isOfflineReady = !!localStorage.getItem('sutta_offline_version');
        const isOfflineBuild = !!window.__DB_INDEX__;

        const shouldMergeTree = isFileProtocol || isOfflineReady || isOfflineBuild;

        // [OPTIMIZATION] Xử lý TPK Cache để tránh latency mạng giả lập
        let tpkPromise;
        if (_tpkCache) {
            tpkPromise = Promise.resolve(_tpkCache);
        } else {
            tpkPromise = SuttaRepository.fetchMeta('tpk').then(data => {
                if (data) _tpkCache = data;
                return data;
            }).catch(() => null);
        }

        // [DEBUG TIMER] Đo thời gian fetch dữ liệu
        const fetchLabel = `📥 Data Fetch (${uid})`;
        console.time(fetchLabel);

        const promises = [
            SuttaRepository.fetchMeta(hintBook),
            tpkPromise 
        ];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, superMeta, contentChunk] = await Promise.all(promises);
        
        console.timeEnd(fetchLabel);

        if (!bookMeta) return null;
        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 1. Check Alias Explicit (Alias cứng trong data)
        if (metaEntry.type === 'alias') {
            return { 
                isAlias: true, 
                targetUid: metaEntry.target_uid,
                hashId: metaEntry.hash_id 
            };
        }

        // --- RESOLVE STRUCTURE ---
        const { tree: finalTree, contextMeta: finalContextMeta } = 
            await StructureStrategy.resolveContext(bookMeta, uid, shouldMergeTree);

        // 2. [NEW] Check Implicit Single Chain (Alias mềm do cấu trúc)
        const currentNode = findNodeInTree(finalTree, uid);
        const singleChildTarget = getSingleChildTarget(currentNode);

        if (singleChildTarget && singleChildTarget !== uid) {
            logger.info("loadSutta", `Auto-redirecting single chain: ${uid} -> ${singleChildTarget}`);
            return {
                isAlias: true,
                targetUid: singleChildTarget
            };
        }

        // --- CONTENT EXTRACTION ---
        let content = null;
        if (contentChunk) {
            if (contentChunk[uid]) {
                content = contentChunk[uid];
            } 
            else if (metaEntry.parent_uid) {
                const parentUid = metaEntry.parent_uid;
                if (contentChunk[parentUid]) {
                    const parentContent = contentChunk[parentUid];
                    const extractKey = metaEntry.extract_id || uid;
                    content = SuttaExtractor.extract(parentContent, extractKey);
                    if (!content) {
                        logger.error("loadSutta", `Extraction failed. Parent '${parentUid}' found, but extract '${extractKey}' returned null.`);
                    }
                } else {
                    logger.warn("loadSutta", `Parent '${parentUid}' NOT found in Chunk ${hintChunk}.`);
                }
            } else {
                if (metaEntry.type === 'leaf' || metaEntry.type === 'subleaf') {
                     logger.warn("loadSutta", `No content for ${uid} and no parent_uid defined.`);
                }
            }
        }

        // --- NAVIGATION ---
        const nav = metaEntry.nav || {};
        const navMeta = {};
        const neighborsToFetch = [];

        const checkAndAdd = (nid) => {
            if (!nid) return;
            if (bookMeta.meta[nid]) {
                navMeta[nid] = bookMeta.meta[nid];
            } else {
                neighborsToFetch.push(nid);
            }
        };

        checkAndAdd(nav.prev);
        checkAndAdd(nav.next);

        if (neighborsToFetch.length > 0) {
            // Chỉ fetch meta cho nav, không chặn luồng chính quá lâu nếu không cần thiết
            // Nhưng hiện tại vẫn await để đảm bảo render nav bar đúng
            const extraMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
            Object.assign(navMeta, extraMeta);
            
            if (options.prefetchNav) {
                neighborsToFetch.forEach(neighborUid => {
                     this.loadSutta(neighborUid, { prefetchNav: false })
                        .catch(e => logger.warn("Prefetch", `Failed to prefetch ${neighborUid}`));
                });
            }
        }
        
        if (options.prefetchNav) {
             [nav.prev, nav.next].forEach(nid => {
                 if (nid && bookMeta.meta[nid]) { 
                     this.loadSutta(nid, { prefetchNav: false }).catch(() => {});
                 }
             });
        }

        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            
            tree: finalTree, 
            bookStructure: finalTree, 
            contextMeta: finalContextMeta,
            
            superTree: superMeta ? superMeta.tree : null,
            superMeta: superMeta ? superMeta.meta : null,
            
            nav: nav,
            navMeta: navMeta
        };
    }
};