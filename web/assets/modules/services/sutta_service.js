// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    // ... (Giữ nguyên các hàm _buildSuperToc và init) ...
    async _buildSuperToc(superBookMeta, uidBeingLoaded) {
        let mergedTree = JSON.parse(JSON.stringify(superBookMeta.tree));
        let mergedMeta = { ...superBookMeta.meta };
        let allSubBookIds = new Set();
        
        for (const key in superBookMeta.tree) {
            const children = superBookMeta.tree[key];
            if (Array.isArray(children)) {
                children.forEach(childId => allSubBookIds.add(childId));
            }
        }

        const subBookMetas = await Promise.all(
            Array.from(allSubBookIds).map(async (subBookId) => ({
                id: subBookId,
                meta: await SuttaRepository.fetchMeta(subBookId)
            }))
        );

        const subBookMetaMap = {};
        subBookMetas.forEach(entry => {
            if (entry.meta) {
                subBookMetaMap[entry.id] = entry.meta;
                Object.assign(mergedMeta, entry.meta.meta); 
            }
        });

        const mergeTrees = (currentSuperTreePart, subBookMetaMap, parentKey = null) => {
            if (Array.isArray(currentSuperTreePart)) {
                const newArray = [];
                currentSuperTreePart.forEach(itemId => {
                    if (subBookMetaMap[itemId] && subBookMetaMap[itemId].tree) {
                        const subTree = subBookMetaMap[itemId].tree;
                        let extractedContent = null;
                        
                        if (parentKey && subTree[parentKey] && subTree[parentKey][itemId]) {
                            extractedContent = subTree[parentKey][itemId];
                        } 
                        else {
                             for (const key in subTree) {
                                 if (subTree[key] && subTree[key][itemId]) {
                                     extractedContent = subTree[key][itemId];
                                     break;
                                 }
                                 if (key === itemId) {
                                     extractedContent = subTree[key];
                                     break;
                                 }
                             }
                        }

                        if (extractedContent) {
                            const recursivelyMergedContent = mergeTrees(extractedContent, subBookMetaMap, itemId);
                            newArray.push({ [itemId]: recursivelyMergedContent });
                        } else {
                            newArray.push(itemId);
                        }
                    } else {
                        newArray.push(itemId);
                    }
                });
                return newArray.flat(); 
            } else if (typeof currentSuperTreePart === 'object' && currentSuperTreePart !== null) {
                const newObject = {};
                for (const key in currentSuperTreePart) {
                    newObject[key] = mergeTrees(currentSuperTreePart[key], subBookMetaMap, key);
                }
                return newObject;
            }
            return currentSuperTreePart;
        };

        mergedTree = mergeTrees(mergedTree, subBookMetaMap);
        return { tree: mergedTree, meta: mergedMeta };
    },
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

        // 1. Locate
        if (hintBook === null || hintChunk === null) {
            let loc = await SuttaRepository.resolveLocation(uid);
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        const isFileProtocol = window.location.protocol === 'file:';
        const isOfflineReady = !!localStorage.getItem('sutta_offline_version');
        const shouldBuildSuperToc = isFileProtocol || isOfflineReady;

        // 2. Fetch Data
        const promises = [
            SuttaRepository.fetchMeta(hintBook),
            shouldBuildSuperToc ? SuttaRepository.fetchMeta('tpk') : Promise.resolve(null)
        ];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const results = await Promise.all(promises);
        const bookMeta = results[0];
        const superMeta = results[1]; 
        const contentChunk = hintChunk !== null ? results[2] : null;

        if (!bookMeta) return null;
        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 3. Alias Redirect [UPDATED]
        if (metaEntry.type === 'alias') {
            return { 
                isAlias: true, 
                targetUid: metaEntry.target_uid,
                hashId: metaEntry.hash_id // [NEW] Pass hash_id to controller
            };
        }

        let finalTree = null;
        let finalContextMeta = { ...bookMeta.meta };

        if (bookMeta.type === 'book') {
            finalTree = bookMeta.tree;
        } else if (bookMeta.type === 'super_book') {
            if (shouldBuildSuperToc) {
                const superTocData = await this._buildSuperToc(bookMeta, uid);
                finalTree = superTocData.tree;
                Object.assign(finalContextMeta, superTocData.meta);
            } else {
                finalTree = bookMeta.tree;
            }
        } else if (bookMeta.type === 'sub_book') {
            if (shouldBuildSuperToc) {
                const superBookId = bookMeta.super_book_id;
                if (!superBookId) {
                    logger.error("loadSutta", `Sub-book ${bookMeta.uid} is missing super_book_id`);
                    finalTree = bookMeta.tree;
                } else {
                    const superBookMeta = await SuttaRepository.fetchMeta(superBookId);
                    if (!superBookMeta) {
                        logger.error("loadSutta", `Failed to fetch super_book meta for ${superBookId}`);
                        finalTree = bookMeta.tree;
                    } else {
                        const superTocData = await this._buildSuperToc(superBookMeta, uid);
                        finalTree = superTocData.tree;
                        Object.assign(finalContextMeta, superTocData.meta);
                    }
                }
            } else {
                finalTree = bookMeta.tree;
            }
        } else {
            logger.warn("loadSutta", `Unknown book type: ${bookMeta.type} for UID ${uid}`);
            finalTree = bookMeta.tree; 
        }

        // 4. Extract Content
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

        // 5. Navigation Logic
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