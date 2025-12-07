// Path: web/assets/modules/utils/navigator_logic.js

// Helper: Trích xuất ID từ một node trong Structure
// - Nếu là String ("an1.11-20") -> Trả về chính nó.
// - Nếu là Object ({"an1.1-10": [...]}) -> Trả về Key ("an1.1-10").
function getIdFromNode(node) {
    if (typeof node === 'string') return node;
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        return Object.keys(node)[0];
    }
    return null;
}

// Helper: Tìm path đến node chứa targetId
// Trả về mảng các context: [{ container, index, id }, ...]
function findPath(structure, targetId, currentPath = []) {
    // 1. Duyệt Array (Container chính)
    if (Array.isArray(structure)) {
        for (let i = 0; i < structure.length; i++) {
            const node = structure[i];
            const nodeId = getIdFromNode(node);

            // Case A: Node chính là Target (Leaf hoặc Parent Leaf)
            if (nodeId === targetId) {
                return [...currentPath, { container: structure, index: i, id: nodeId }];
            }

            // Case B: Node là Object chứa con (Parent Leaf chứa Subleaves)
            if (typeof node === 'object' && nodeId) {
                // Nếu Target nằm trong đám con này
                const children = node[nodeId];
                if (Array.isArray(children)) {
                    // Đệ quy vào trong
                    const result = findPath(children, targetId, [
                        ...currentPath, 
                        { container: structure, index: i, id: nodeId }, // Context cha
                        { container: children, index: -1, id: 'subleaf_wrapper' } // Context wrapper con
                    ]);
                    if (result) return result;
                }
            }
        }
    } 
    // 2. Duyệt Subleaf List (đệ quy từ Case B)
    // Lưu ý: Case B ở trên đã handle việc chui vào array con rồi, 
    // nên ở đây ta chỉ check match string đơn giản.
    
    return null;
}

function resolveNeighbor(path, direction) {
    // Duyệt ngược từ cuối path lên đầu (Bubble Up)
    // path = [RootContext, ParentContext, SubleafContext...]
    
    for (let i = path.length - 1; i >= 0; i--) {
        const context = path[i];
        
        // context.index là vị trí của node hiện tại trong context.container
        // Nếu context là wrapper ảo (như lúc chui vào object), ta bỏ qua để lên cấp cao hơn
        if (context.index === -1 && Array.isArray(context.container)) {
             // Đây là trường hợp Subleaf tìm trong mảng con.
             // Ta cần tìm index thực sự của ID trong mảng này.
             // Tuy nhiên, để đơn giản, ta tìm lại index:
             const currentId = path[path.length-1].id; // ID của item đang xét (ví dụ an1.1)
             const realIndex = context.container.indexOf(currentId);
             
             if (realIndex !== -1) {
                 const siblingIndex = realIndex + direction;
                 if (context.container[siblingIndex]) {
                     return getIdFromNode(context.container[siblingIndex]);
                 }
             }
             // Nếu không thấy sibling trong mảng con -> Continue loop để leo lên cha (Parent Leaf)
             continue;
        }

        // Logic cho container cấp cao (Root Array)
        if (context.index !== -1 && Array.isArray(context.container)) {
            const siblingIndex = context.index + direction;
            const siblingNode = context.container[siblingIndex];
            
            if (siblingNode) {
                return getIdFromNode(siblingNode);
            }
            // Nếu hết đường ở cấp này -> Continue loop để leo lên tiếp (ví dụ hết Vagga -> sang Vagga khác)
        }
    }
    
    return null;
}

export function calculateNavigation(structure, currentId) {
    // 1. Tìm đường dẫn ngữ cảnh
    const path = findPath(structure, currentId);
    
    if (!path) return { prev: null, next: null };

    // 2. Resolve theo hướng
    const prev = resolveNeighbor(path, -1);
    const next = resolveNeighbor(path, 1);

    return { prev, next };
}