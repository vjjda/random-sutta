// Path: web/assets/modules/data/logic/sutta_assembler.js
export const SuttaAssembler = {
    /**
     * Xử lý trường hợp bài kinh là Shortcut (Merge meta với cha)
     */
    resolveShortcut(suttaData, chunkData, suttaId) {
        if (suttaData.meta?.type === 'shortcut') {
            const parent = chunkData[suttaData.meta.parent_uid];
            if (parent) {
                return {
                    ...parent,
                    meta: { ...parent.meta, ...suttaData.meta },
                    uid: suttaId
                };
            }
        }
        return suttaData;
    },

    /**
     * Đóng gói dữ liệu cho Branch (Mục lục)
     */
    assembleBranch(suttaId, chunkData) {
        // Với Branch, chunkData chính là Book Object
        const isValid = chunkData.meta[suttaId] || chunkData.id === suttaId || suttaId === 'sutta';
        
        if (!isValid) return null;

        return {
            uid: suttaId,
            content: null,
            meta: { [suttaId]: chunkData.meta[suttaId] || {} },
            isBranch: true,
            bookStructure: chunkData.structure
        };
    },

    /**
     * Đóng gói dữ liệu cho Leaf (Bài kinh)
     */
    assembleLeaf(suttaId, rawSuttaData, bookStructure) {
        return {
            uid: suttaId,
            content: rawSuttaData.content || null,
            meta: { [suttaId]: rawSuttaData.meta },
            isBranch: false,
            bookStructure: bookStructure || null
        };
    }
};