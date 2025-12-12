// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js';
import { StructureStrategy } from './structure_strategy.js';
const logger = getLogger("SuttaService");

// [NEW] Helper: Tìm node trong cây cấu trúc dựa trên UID
function findNodeInTree(structure, targetId) {
    if (!structure) return null;
    // Nếu structure là array, duyệt từng phần tử
    if (Array.isArray(structure)) {
        for (const child of structure) {
            // Nếu con là string và khớp ID -> Trả về "LEAF" (để phân biệt với null)
            if (typeof child === 'string') {
                if (child === targetId) return "LEAF";
            } else {
                // Nếu con là object, đệ quy
                const res = findNodeInTree(child, targetId);
                if (res) return res;
            }
        }
        return null;
    }
    // Nếu structure là object (Dictionary hoặc Node Wrapper)
    if (typeof structure === 'object') {
        // Nếu tìm thấy key khớp -> Trả về nội dung bên trong (Value)
        if (structure[targetId]) return structure[targetId];
        // Nếu không, tìm trong các con
        for (const key in structure) {
            const res = findNodeInTree(structure[key], targetId);
            if (res) return res;
        }
    }
    return null;
}

// [NEW] Helper: Xác định xem node này có phải là Single Chain không
// Trả về UID của con duy nhất nếu có, ngược lại trả về null
function getSingleChildTarget(nodeContent) {
    if (!nodeContent || nodeContent === "LEAF") return null;
    // Trường hợp 1: Array có đúng 1 phần tử [ "dn" ] hoặc [ { "kn": ... } ]
    if (Array.isArray(nodeContent) && nodeContent.length === 1) {
        const child = nodeContent[0];
        // Con là String -> OK (VD: "dn")
        if (typeof child === 'string') return child;
        // Con là Object có 1 key -> OK (VD: { "kn": [...] })
        if (typeof child === 'object') {
            const keys = Object.keys(child);
            if (keys.length === 1) return keys[0];
        }
    }
    
    // Trường hợp 2: Object dạng Wrapper { "long": ["dn"] } (ít gặp nếu đã unwrap ở findNode, nhưng dự phòng)
    if (typeof nodeContent === 'object' && !Array.isArray(nodeContent)) {
        const keys = Object.keys(nodeContent);
        if (keys.length === 1) {
             const childVal = nodeContent[keys[0]];
             // Chỉ redirect nếu value cũng là single
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
        
        // [FIX] Kiểm tra thêm biến global __DB_INDEX__
        // Biến này được inject bởi 'offline_converter.py' trong quá trình build offline.
        // Nếu nó tồn tại, nghĩa là ta đang chạy bản dev-offline (dù là trên http hay file://).
        const isOfflineBuild = !!window.__DB_INDEX__;

        const shouldFetchTpk = true; 
        
        // [UPDATED] Merge tree nếu là File Protocol HOẶC đã cache Offline HOẶC là bản Build Offline
        const shouldMergeTree = isFileProtocol || isOfflineReady || isOfflineBuild;

        const promises = [
            SuttaRepository.fetchMeta(hintBook),
            shouldFetchTpk ? SuttaRepository.fetchMeta('tpk') : Promise.resolve(null)
        ];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, superMeta, contentChunk] = await Promise.all(promises);

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
        // Tìm vị trí của UID hiện tại trong cây
        const currentNode = findNodeInTree(finalTree, uid);
        const singleChildTarget = getSingleChildTarget(currentNode);

        // Nếu tìm thấy con duy nhất và con đó không phải chính nó (tránh loop)
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
                // Chỉ warn nếu đây là Leaf mà không có content.
                // Branch thì không cần content.
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