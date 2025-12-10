// Path: web/assets/modules/services/structure_strategy.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("StructureStrategy");

export const StructureStrategy = {
    async buildSuperToc(superBookMeta) {
        let mergedTree = JSON.parse(JSON.stringify(superBookMeta.tree));
        let mergedMeta = { ...superBookMeta.meta };
        let allSubBookIds = new Set();
        
        // 1. Collect Sub-book IDs
        const collectIds = (node) => {
            if (Array.isArray(node)) {
                node.forEach(child => { if (typeof child === 'string') allSubBookIds.add(child); });
            } else if (typeof node === 'object' && node !== null) {
                Object.values(node).forEach(val => collectIds(val));
            }
        };
        collectIds(mergedTree);

        // 2. Fetch all Sub-book Metas
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

        // 3. Recursive Merge Logic
        const mergeTrees = (currentSuperTreePart, subBookMetaMap, parentKey = null) => {
            if (Array.isArray(currentSuperTreePart)) {
                const newArray = [];
                currentSuperTreePart.forEach(itemId => {
                    if (typeof itemId === 'string' && subBookMetaMap[itemId] && subBookMetaMap[itemId].tree) {
                        const subTree = subBookMetaMap[itemId].tree;
                        let extractedContent = null;
                        
                        // [UPDATED] Smart Unwrap Strategy
                        
                        // 1. Direct Match: { "an1": ... }
                        if (subTree[itemId]) {
                            extractedContent = subTree[itemId];
                        }
                        // 2. Parent Wrapper: { "an": ... }
                        else if (parentKey && subTree[parentKey]) {
                            const container = subTree[parentKey];
                            
                            // IMPORTANT: Ignore if container is just an Array (it's likely a mirror of the supertree list)
                            if (!Array.isArray(container)) {
                                // 2a. Nested Exact Match: { "an": { "an1": ... } }
                                if (container[itemId]) {
                                    extractedContent = container[itemId];
                                } 
                                // 2b. Content Unwrap: { "an": { "an1-vagga": ... } }
                                // If the container doesn't have the key, but is an object, assume it IS the content.
                                else {
                                    extractedContent = container;
                                }
                            }
                        }
                        // 3. Fallback: First Key (Use with caution, ensure not array)
                        else {
                            const keys = Object.keys(subTree);
                            if (keys.length > 0 && !Array.isArray(subTree[keys[0]])) {
                                extractedContent = subTree[keys[0]];
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