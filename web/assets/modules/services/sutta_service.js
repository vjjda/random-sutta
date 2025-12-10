// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js';
import { StructureStrategy } from './structure_strategy.js'; // [NEW IMPORT]

const logger = getLogger("SuttaService");

export const SuttaService = {
    async init() {
        await SuttaRepository.init();
        RandomHelper.init(); 
    },

    async loadSutta(input, options = { prefetchNav: true }) {
        // --- 1. Input Parsing & Locating ---
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

        // --- 2. Environment Check ---
        const isFileProtocol = window.location.protocol === 'file:';
        const isOfflineReady = !!localStorage.getItem('sutta_offline_version');
        // Logic: Chỉ build Super TOC (gộp cây) khi chạy Offline hoặc File Protocol
        // Online thì dùng Lazy Load để tiết kiệm băng thông.
        const shouldBuildSuperToc = isFileProtocol || isOfflineReady;

        // --- 3. Parallel Data Fetching ---
        const promises = [
            SuttaRepository.fetchMeta(hintBook),
            shouldBuildSuperToc ? SuttaRepository.fetchMeta('tpk') : Promise.resolve(null)
        ];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, superMeta, contentChunk] = await Promise.all(promises);

        if (!bookMeta) return null;
        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // --- 4. Handle Alias Redirect (Clean) ---
        if (metaEntry.type === 'alias') {
            return { 
                isAlias: true, 
                targetUid: metaEntry.target_uid,
                hashId: metaEntry.hash_id 
            };
        }

        // --- 5. Resolve Structure (Delegated to Strategy) ---
        // Phần logic phức tạp nhất đã được chuyển đi
        const { tree: finalTree, contextMeta: finalContextMeta } = 
            await StructureStrategy.resolveContext(bookMeta, uid, shouldBuildSuperToc);

        // --- 6. Content Extraction ---
        let content = null;
        if (contentChunk) {
            if (contentChunk[uid]) {
                content = contentChunk[uid];
            } 
            else if (metaEntry.parent_uid && contentChunk[metaEntry.parent_uid]) {
                const parentContent = contentChunk[metaEntry.parent_uid];
                const extractKey = metaEntry.extract_id || uid;
                content = SuttaExtractor.extract(parentContent, extractKey);
            }
        }

        // --- 7. Navigation & Prefetching ---
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

        // --- 8. Final Return Object ---
        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            
            // Core Structure Data
            tree: finalTree, 
            bookStructure: finalTree, // Legacy alias
            contextMeta: finalContextMeta,
            
            // Super Data (TPK for breadcrumbs)
            superTree: superMeta ? superMeta.tree : null,
            superMeta: superMeta ? superMeta.meta : null,
            
            nav: nav,
            navMeta: navMeta
        };
    }
};