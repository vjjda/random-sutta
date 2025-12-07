// Path: web/assets/modules/utils/navigator_logic.js

function getIdFromNode(node) {
    if (typeof node === 'string') return node;
    // Nếu node là object { "key": [...] }, ID chính là key đó
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        return Object.keys(node)[0];
    }
    return null;
}

function findPath(structure, targetId, currentPath = []) {
    if (Array.isArray(structure)) {
        for (let i = 0; i < structure.length; i++) {
            const node = structure[i];
            const nodeId = getIdFromNode(node);

            // Match chính xác (Leaf hoặc Parent Leaf)
            if (nodeId === targetId) {
                return [...currentPath, { container: structure, index: i, id: nodeId }];
            }

            // Chui vào trong Object (tìm Subleaf)
            if (typeof node === 'object' && nodeId) {
                const children = node[nodeId];
                if (Array.isArray(children)) {
                    // Đệ quy
                    const result = findPath(children, targetId, [
                        ...currentPath, 
                        { container: structure, index: i, id: nodeId }, // Context cha (Vagga)
                        { container: children, index: -1, id: 'subleaf_wrapper' } // Context con (Subleaf List)
                    ]);
                    if (result) return result;
                }
            }
        }
    } 
    // Fallback cho trường hợp structure là object root { "mn": [...] }
    else if (typeof structure === 'object' && structure !== null) {
         for (const key of Object.keys(structure)) {
             const result = findPath(structure[key], targetId, currentPath); // Pass through
             if (result) return result;
         }
    }
    
    return null;
}

function resolveNeighbor(path, direction) {
    // Duyệt ngược từ cuối path lên (Bubble Up)
    for (let i = path.length - 1; i >= 0; i--) {
        const context = path[i];
        
        // 1. Xử lý Subleaf List (index = -1 do wrapper ảo)
        if (context.index === -1 && Array.isArray(context.container)) {
             const currentId = path[path.length-1].id; 
             const realIndex = context.container.indexOf(currentId);
             
             if (realIndex !== -1) {
                 const siblingIndex = realIndex + direction;
                 // Nếu tìm thấy anh em trong cùng mảng subleaf -> Trả về luôn
                 if (context.container[siblingIndex]) {
                     return getIdFromNode(context.container[siblingIndex]);
                 }
             }
             // Hết đường subleaf -> Continue để leo lên cha (Parent Context)
             continue;
        }

        // 2. Xử lý Container thường (Vagga/Book)
        if (context.index !== -1 && Array.isArray(context.container)) {
            const siblingIndex = context.index + direction;
            const siblingNode = context.container[siblingIndex];
            
            // Nếu tìm thấy anh em của Parent -> Trả về ID của nó
            // [QUAN TRỌNG] Đây chính là logic "Next của an1.10 là an1.11-20"
            if (siblingNode) {
                return getIdFromNode(siblingNode);
            }
            // Hết đường -> Continue leo lên tiếp
        }
    }
    return null;
}

export function calculateNavigation(structure, currentId) {
    const path = findPath(structure, currentId);
    if (!path) return { prev: null, next: null };

    return { 
        prev: resolveNeighbor(path, -1), 
        next: resolveNeighbor(path, 1) 
    };
}