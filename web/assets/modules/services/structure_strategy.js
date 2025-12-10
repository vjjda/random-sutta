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
        
        // 1. Collect Sub-book IDs from Root Keys
        // Ví dụ: tree = { "an": ["an1", "an2"] } -> Collect an1, an2
        const collectIds = (node) => {
            if (Array.isArray(node)) {
                node.forEach(child => {
                    if (typeof child === 'string') allSubBookIds.add(child);
                });
            } else if (typeof node === 'object' && node !== null) {
                Object.values(node).forEach(val => collectIds(val));
            }
        };
        collectIds(mergedTree);

        // 2. Fetch all Sub-book Metas concurrently
        const subBookMetas = await Promise.all(
            Array.from(allSubBookIds).map(async (subBookId) => {
                try {
                    const meta = await SuttaRepository.fetchMeta(subBookId);
                    return { id: subBookId, meta };
                } catch (e) {
                    logger.warn("buildSuperToc", `Failed to fetch meta for sub-book ${subBookId}`, e);
                    return { id: subBookId, meta: null };
                }
            })
        );

        const subBookMetaMap = {};
        subBookMetas.forEach(entry => {
            if (entry.meta) {
                subBookMetaMap[entry.id] = entry.meta;
                // Merge Sub-book meta into Super-book meta context
                if (entry.meta.meta) {
                    Object.assign(mergedMeta, entry.meta.meta);
                }
            }
        });

        // 3. Recursive Merge Logic
        const mergeTrees = (currentSuperTreePart, subBookMetaMap, parentKey = null) => {
            if (Array.isArray(currentSuperTreePart)) {
                const newArray = [];
                currentSuperTreePart.forEach(itemId => {
                    // Check if this item is a Sub-book that needs expansion
                    if (typeof itemId === 'string' && subBookMetaMap[itemId] && subBookMetaMap[itemId].tree) {
                        const subTree = subBookMetaMap[itemId].tree;
                        let extractedContent = null;
                        
                        // Strategy A: Exact Match (e.g. subTree["an"]["an1"])
                        if (parentKey && subTree[parentKey] && subTree[parentKey][itemId]) {
                            extractedContent = subTree[parentKey][itemId];
                        } 
                        // Strategy B: Direct Key Match (e.g. subTree["an1"]) - Handles inconsistent wrapping
                        else if (subTree[itemId]) {
                            extractedContent = subTree[itemId];
                        }
                        // Strategy C: Scan keys (Fallback)
                        else {
                             for (const key in subTree) {
                                 if (subTree[key] && subTree[key][itemId]) {
                                     extractedContent = subTree[key][itemId];
                                     break;
                                 }
                             }
                        }

                        if (extractedContent) {
                            // Recursively merge deeply (in case sub-book has its own sub-books)
                            // We wrap it back in { [itemId]: content } to maintain the Branch structure
                            const recursivelyMergedContent = mergeTrees(extractedContent, subBookMetaMap, itemId);
                            newArray.push({ [itemId]: recursivelyMergedContent });
                        } else {
                            // Data exists but structure mismatch? Keep ID as leaf to avoid crash
                            logger.warn("buildSuperToc", `Content extraction failed for ${itemId} (Parent: ${parentKey})`);
                            newArray.push(itemId);
                        }
                    } else {
                        // Not a sub-book or data missing, keep as is
                        newArray.push(itemId);
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
                    try {
                        const superBookMeta = await SuttaRepository.fetchMeta(superBookId);
                        if (!superBookMeta) {
                            throw new Error("Super book meta not found");
                        }
                        const superTocData = await this.buildSuperToc(superBookMeta);
                        finalTree = superTocData.tree;
                        Object.assign(finalContextMeta, superTocData.meta);
                    } catch (e) {
                        logger.error("resolveContext", `Failed to build Super TOC for ${superBookId}`, e);
                        finalTree = bookMeta.tree; // Fallback to local tree
                    }
                }
            } else {
                finalTree = bookMeta.tree;
            }
        } else {
            // Fallback for unknown types
            finalTree = bookMeta.tree;
        }

        return {
            tree: finalTree,
            contextMeta: finalContextMeta
        };
    }
};