// Path: web/assets/modules/services/structure_strategy.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("StructureStrategy");

export const StructureStrategy = {
    /**
     * Hợp nhất cây thư mục con vào cây thư mục mẹ (dành cho Super Books như AN, SN)
     */
    async buildSuperToc(superBookMeta) {
        let mergedTree = JSON.parse(JSON.stringify(superBookMeta.tree));
        let mergedMeta = { ...superBookMeta.meta };
        let allSubBookIds = new Set();
        
        // 1. Collect Sub-book IDs
        for (const key in superBookMeta.tree) {
            const children = superBookMeta.tree[key];
            if (Array.isArray(children)) {
                children.forEach(childId => allSubBookIds.add(childId));
            }
        }

        // 2. Fetch all Sub-book Metas concurrently
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

        // 3. Recursive Merge Logic
        const mergeTrees = (currentSuperTreePart, subBookMetaMap, parentKey = null) => {
            if (Array.isArray(currentSuperTreePart)) {
                const newArray = [];
                currentSuperTreePart.forEach(itemId => {
                    if (subBookMetaMap[itemId] && subBookMetaMap[itemId].tree) {
                        const subTree = subBookMetaMap[itemId].tree;
                        let extractedContent = null;
                        
                        // Try exact parent match or scan keys
                        if (parentKey && subTree[parentKey] && subTree[parentKey][itemId]) {
                            extractedContent = subTree[parentKey][itemId];
                        } else {
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

    /**
     * Quyết định xem sẽ trả về Tree/Meta nào dựa trên loại sách và môi trường (Offline/Online)
     */
    async resolveContext(bookMeta, uid, shouldBuildSuperToc) {
        let finalTree = null;
        let finalContextMeta = { ...bookMeta.meta };

        if (bookMeta.type === 'book') {
            finalTree = bookMeta.tree;
        } else if (bookMeta.type === 'super_book') {
            if (shouldBuildSuperToc) {
                const superTocData = await this.buildSuperToc(bookMeta);
                finalTree = superTocData.tree;
                Object.assign(finalContextMeta, superTocData.meta);
            } else {
                finalTree = bookMeta.tree;
            }
        } else if (bookMeta.type === 'sub_book') {
            if (shouldBuildSuperToc) {
                const superBookId = bookMeta.super_book_id;
                if (!superBookId) {
                    logger.error("resolveContext", `Sub-book ${bookMeta.uid} is missing super_book_id`);
                    finalTree = bookMeta.tree;
                } else {
                    const superBookMeta = await SuttaRepository.fetchMeta(superBookId);
                    if (!superBookMeta) {
                        logger.error("resolveContext", `Failed to fetch super_book meta for ${superBookId}`);
                        finalTree = bookMeta.tree;
                    } else {
                        const superTocData = await this.buildSuperToc(superBookMeta);
                        finalTree = superTocData.tree;
                        Object.assign(finalContextMeta, superTocData.meta);
                    }
                }
            } else {
                finalTree = bookMeta.tree;
            }
        } else {
            logger.warn("resolveContext", `Unknown book type: ${bookMeta.type} for UID ${uid}`);
            finalTree = bookMeta.tree;
        }

        return {
            tree: finalTree,
            contextMeta: finalContextMeta
        };
    }
};