// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js';

const logger = getLogger("SuttaService");

export const SuttaService = {
    async _buildSuperToc(superBookMeta, uidBeingLoaded) {
        let mergedTree = JSON.parse(JSON.stringify(superBookMeta.tree)); // Deep clone to avoid modifying original
        let mergedMeta = { ...superBookMeta.meta };
        let allSubBookIds = new Set();
        
        // Collect all sub-book IDs from the super_book's top-level tree
        for (const key in superBookMeta.tree) {
            const children = superBookMeta.tree[key];
            if (Array.isArray(children)) {
                children.forEach(childId => allSubBookIds.add(childId));
            }
        }

        // Fetch meta for all sub-books concurrently
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
                Object.assign(mergedMeta, entry.meta.meta); // Merge sub-book's meta
            }
        });
        
        // Function to deeply merge trees
        const mergeTrees = (currentSuperTreePart, subBookMetaMap, parentKey = null) => {
            if (Array.isArray(currentSuperTreePart)) {
                // If it's an array of sub-book IDs, replace with their actual trees
                const newArray = [];
                currentSuperTreePart.forEach(itemId => {
                    if (subBookMetaMap[itemId] && subBookMetaMap[itemId].tree) {
                        const subTree = subBookMetaMap[itemId].tree;
                        // Special handling: sub-book tree is wrapped in { [parentKey]: { [itemId]: ... } }
                        // We need to extract the content inside that wrapper.
                        let extractedContent = null;
                        
                        // Try to find the content using the parentKey (e.g. "an") and itemId (e.g. "an1")
                        if (parentKey && subTree[parentKey] && subTree[parentKey][itemId]) {
                            extractedContent = subTree[parentKey][itemId];
                        } 
                        // Fallback: iterate to find the key matching itemId if parentKey structure doesn't match
                        else {
                             for (const key in subTree) {
                                 if (subTree[key] && subTree[key][itemId]) {
                                     extractedContent = subTree[key][itemId];
                                     break;
                                 }
                                 // Deeper search if needed? Assuming shallow wrapper for now.
                                 if (key === itemId) {
                                     extractedContent = subTree[key];
                                     break;
                                 }
                             }
                        }

                        if (extractedContent) {
                            // Recursively merge if the sub-book itself has further nested sub-books (unlikely for now but safe)
                            // Note: we wrap it back in { itemId: content } to maintain the Branch structure
                            const recursivelyMergedContent = mergeTrees(extractedContent, subBookMetaMap, itemId);
                            newArray.push({ [itemId]: recursivelyMergedContent });
                        } else {
                            // Fallback if extraction fails: just keep the ID or push the whole tree?
                            // Keeping ID is safer than breaking structure
                            newArray.push(itemId); 
                        }
                    } else {
                        newArray.push(itemId); // Keep as is if not a sub-book with a tree
                    }
                });
                return newArray.flat(); 
            } else if (typeof currentSuperTreePart === 'object' && currentSuperTreePart !== null) {
                const newObject = {};
                for (const key in currentSuperTreePart) {
                    // Pass 'key' as the parentKey for the next level (e.g. "an")
                    newObject[key] = mergeTrees(currentSuperTreePart[key], subBookMetaMap, key);
                }
                return newObject;
            }
            return currentSuperTreePart;
        };

        // Recursively merge sub-book trees into the super_book's tree
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

        // 2. Fetch Data (Parallel: Book Meta, Content, [NEW] Super Meta)
        // Fetch 'tpk' để lấy cấu trúc tổng thể (Tipitaka > Sutta > Nikaya)
        const promises = [
            SuttaRepository.fetchMeta(hintBook),
            SuttaRepository.fetchMeta('tpk') 
        ];
        
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        // Resolve Promises
        // [NOTE] Promise.all thứ tự trả về khớp thứ tự mảng promises
        const results = await Promise.all(promises);
        const bookMeta = results[0];
        const superMeta = results[1]; // tpk data
        const contentChunk = hintChunk !== null ? results[2] : null;

        if (!bookMeta) return null;
        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 3. Alias Redirect
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        let finalTree = null;
        let finalContextMeta = { ...bookMeta.meta }; // Start with current book's meta

        // [NEW LOGIC] Handle super_book and sub_book types
        if (bookMeta.type === 'book') {
            // Existing behavior for regular books
            finalTree = bookMeta.tree;
        } else if (bookMeta.type === 'super_book') {
            // For a super_book, build the super_toc from itself
            const superTocData = await this._buildSuperToc(bookMeta, uid);
            finalTree = superTocData.tree;
            Object.assign(finalContextMeta, superTocData.meta);
        } else if (bookMeta.type === 'sub_book') {
            // For a sub_book, we need to fetch its super_book and build the super_toc
            const superBookId = bookMeta.super_book_id;
            if (!superBookId) {
                logger.error("loadSutta", `Sub-book ${bookMeta.uid} is missing super_book_id`);
                return null;
            }
            const superBookMeta = await SuttaRepository.fetchMeta(superBookId);
            if (!superBookMeta) {
                logger.error("loadSutta", `Failed to fetch super_book meta for ${superBookId}`);
                return null;
            }
            const superTocData = await this._buildSuperToc(superBookMeta, uid);
            finalTree = superTocData.tree;
            Object.assign(finalContextMeta, superTocData.meta);
        } else {
            logger.warn("loadSutta", `Unknown book type: ${bookMeta.type} for UID ${uid}`);
            finalTree = bookMeta.tree; // Fallback to local tree
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
            tree: finalTree, // Use the dynamically created or selected tree
            bookStructure: finalTree, // Legacy, should be same as tree
            contextMeta: finalContextMeta, // Use the dynamically created or selected meta map
            // [NEW] Truyền dữ liệu Super (TPK) ra ngoài
            superTree: superMeta ? superMeta.tree : null,
            superMeta: superMeta ? superMeta.meta : null,
            
            nav: nav,
            navMeta: navMeta
        };
    }
};