// Path: web/assets/modules/services/structure_strategy.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("StructureStrategy");

export const StructureStrategy = {
    async buildSuperToc(superBookMeta) {
        let mergedTree = JSON.parse(JSON.stringify(superBookMeta.tree));
        let mergedMeta = { ...superBookMeta.meta };
        let allSubBookIds = new Set();
        
        const collectIds = (node) => {
            if (Array.isArray(node)) {
                node.forEach(child => { if (typeof child === 'string') allSubBookIds.add(child); });
            } else if (typeof node === 'object' && node !== null) {
                Object.values(node).forEach(val => collectIds(val));
            }
        };
        collectIds(mergedTree);

        const subBookMetas = await Promise.all(
            Array.from(allSubBookIds).map(async (subBookId) => {
                try {
                    const meta = await SuttaRepository.fetchMeta(subBookId);
                    return { id: subBookId, meta };
                } catch (e) {
                    return { id: subBookId, meta: null };
                }
            })
        );

        const subBookMetaMap = {};
        subBookMetas.forEach(entry => {
            if (entry.meta) {
                subBookMetaMap[entry.id] = entry.meta;
                if (entry.meta.meta) Object.assign(mergedMeta, entry.meta.meta);
            }
        });

        const mergeTrees = (currentSuperTreePart, subBookMetaMap, parentKey = null) => {
            if (Array.isArray(currentSuperTreePart)) {
                const newArray = [];
                currentSuperTreePart.forEach(itemId => {
                    if (typeof itemId === 'string' && subBookMetaMap[itemId] && subBookMetaMap[itemId].tree) {
                        const subTree = subBookMetaMap[itemId].tree;
                        let extractedContent = null;
                        
                        // --- DEBUG LOG START ---
                        if (itemId === 'an1') {
                            logger.info("DebugMerge", `Analyzing 'an1'. Keys found in subTree: ${Object.keys(subTree).join(', ')}`);
                        }
                        // --- DEBUG LOG END ---

                        // 1. Exact Match
                        if (subTree[itemId]) {
                            extractedContent = subTree[itemId];
                        }
                        // 2. Parent Match
                        else if (parentKey && subTree[parentKey] && subTree[parentKey][itemId]) {
                            extractedContent = subTree[parentKey][itemId];
                        }
                        // 3. First Key Fallback (Robust)
                        else {
                            const keys = Object.keys(subTree);
                            if (keys.length > 0) {
                                // Nếu keys[0] khác itemId, log warning để biết
                                if (keys[0] !== itemId) {
                                    logger.warn("DebugMerge", `Mismatch! ID: ${itemId} vs Key: ${keys[0]}. Using fallback.`);
                                }
                                extractedContent = subTree[keys[0]];
                            }
                        }

                        if (extractedContent) {
                            // Recursively merge
                            const recursivelyMergedContent = mergeTrees(extractedContent, subBookMetaMap, itemId);
                            // Wrap lại để giữ cấu trúc
                            newArray.push({ [itemId]: recursivelyMergedContent });
                        } else {
                            logger.error("DebugMerge", `Failed to extract content for ${itemId}`);
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

    // ... (Giữ nguyên hàm resolveContext như cũ) ...
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
                if (superBookId) {
                    try {
                        const superBookMeta = await SuttaRepository.fetchMeta(superBookId);
                        if (superBookMeta) {
                            const superTocData = await this.buildSuperToc(superBookMeta);
                            finalTree = superTocData.tree;
                            Object.assign(finalContextMeta, superTocData.meta);
                        } else {
                            finalTree = bookMeta.tree;
                        }
                    } catch (e) {
                        finalTree = bookMeta.tree; 
                    }
                } else {
                    finalTree = bookMeta.tree;
                }
            } else {
                finalTree = bookMeta.tree;
            }
        } else {
            finalTree = bookMeta.tree;
        }

        return {
            tree: finalTree,
            contextMeta: finalContextMeta
        };
    }
};