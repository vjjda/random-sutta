// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js';
import { StructureStrategy } from './structure_strategy.js';

const logger = getLogger("SuttaService");

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
        
        // [CHANGED] Chiến lược mới:
        // 1. Luôn tải TPK để có Breadcrumb đẹp.
        // 2. Chỉ gộp cây (Heavy Merge) khi thực sự Offline hoặc File Protocol.
        const shouldFetchTpk = true; // Luôn tải vì nó nhẹ (45KB)
        const shouldMergeTree = isFileProtocol || isOfflineReady; // Chỉ gộp khi cần thiết

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

        if (metaEntry.type === 'alias') {
            return { 
                isAlias: true, 
                targetUid: metaEntry.target_uid,
                hashId: metaEntry.hash_id 
            };
        }

        // --- RESOLVE STRUCTURE ---
        // Truyền cờ shouldMergeTree vào Strategy thay vì shouldBuildSuperToc cũ
        const { tree: finalTree, contextMeta: finalContextMeta } = 
            await StructureStrategy.resolveContext(bookMeta, uid, shouldMergeTree);

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
                logger.warn("loadSutta", `No content for ${uid} and no parent_uid defined.`);
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
            
            // [IMPORTANT] Luôn trả về dữ liệu Super nếu tải được
            // Frontend sẽ dùng cái này để vẽ Breadcrumb
            superTree: superMeta ? superMeta.tree : null,
            superMeta: superMeta ? superMeta.meta : null,
            
            nav: nav,
            navMeta: navMeta
        };
    }
};