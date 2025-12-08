// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js'; // [NEW]

const logger = getLogger("SuttaService");

export const SuttaService = {
    
    async init() {
        await SuttaRepository.init();
        RandomHelper.init(); // [NEW] Delegate init
    },

    // [NEW] Delegate sang Helper
    async getRandomPayload(activeFilters) {
        return await RandomHelper.getRandomPayload(activeFilters);
    },

    // --- CORE LOGIC: LOAD CONTENT ---
    async loadSutta(input) {
        let uid, hintChunk = null, hintBook = null;

        if (typeof input === 'object') {
            uid = input.uid;
            hintChunk = input.chunk || null;
            hintBook = input.book_id || null;
        } else {
            uid = input;
        }

        // 1. Locate
        if (hintBook === null || hintChunk === null) {
            let loc = SuttaRepository.getLocation(uid);
            
            if (!loc) {
                await SuttaRepository.ensureIndex();
                loc = SuttaRepository.getLocation(uid);
            }

            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        // 2. Fetch Data
        const promises = [SuttaRepository.fetchMeta(hintBook)];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, contentChunk] = await Promise.all(promises);
        if (!bookMeta) return null;

        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 3. Alias
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        // 4. Extract
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

        // 5. Nav
        const nav = metaEntry.nav || {};
        const neighborsToFetch = [];
        if (nav.prev) neighborsToFetch.push(nav.prev);
        if (nav.next) neighborsToFetch.push(nav.next);

        let navMeta = {};
        if (neighborsToFetch.length > 0) {
            navMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
        }

        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            tree: bookMeta.tree,
            bookStructure: bookMeta.tree,
            contextMeta: bookMeta.meta,
            nav: nav,
            navMeta: navMeta
        };
    }
};