// Path: web/assets/modules/utils/navigator_logic.js

// --- HELPERS ---
function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

function getLeafList(structure) {
    let list = [];
    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            Object.values(node).forEach(child => traverse(child));
        }
    }
    traverse(structure);
    return list;
}

// --- LOGIC SUBLEAF ---
function getSubleafNavigation(structure, currentId) {
    function findCtx(node) {
        if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                const parentId = Object.keys(node)[0];
                const children = node[parentId];
                if (children.includes(currentId)) return { parentId, children };
            } else if (!Array.isArray(node)) {
                for (const key in node) {
                    const res = findCtx(node[key]);
                    if (res) return res;
                }
            } else if (Array.isArray(node)) {
                for (const child of node) {
                    const res = findCtx(child);
                    if (res) return res;
                }
            }
        }
        return null;
    }
    const ctx = findCtx(structure);
    if (!ctx) return null;
    const { parentId, children } = ctx;
    const idx = children.indexOf(currentId);
    let prev = idx > 0 ? children[idx - 1] : null;
    let next = idx < children.length - 1 ? children[idx + 1] : null;
    if (!prev || !next) {
        const leafList = getLeafList(structure);
        const parentIdx = leafList.indexOf(parentId);
        if (parentIdx !== -1) {
            if (!prev && parentIdx > 0) prev = leafList[parentIdx - 1];
            if (!next && parentIdx < leafList.length - 1) next = leafList[parentIdx + 1];
        }
    }
    return { prev, next, type: 'subleaf' };
}

// --- [FIXED] FLATTEN WITH DEPTH ---
function flattenTreeWithDepth(node, metaMap, depth = 0, list = []) {
    if (!node) return list;

    // 1. Array: Duyệt tuần tự, KHÔNG tăng depth (Array chỉ là container thứ tự trong JSON)
    if (Array.isArray(node)) {
        node.forEach(child => flattenTreeWithDepth(child, metaMap, depth, list));
        return list;
    }

    // 2. Object (Container/Group/Branch)
    if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            // Chỉ thêm vào list nếu Key là một entity có trong Meta (vd: "kn", "dn")
            // Loại bỏ các key rác như "meta", "isBranch" nếu lỡ lọt vào
            if (metaMap && metaMap[key]) {
                list.push({ 
                    id: key, 
                    depth: depth, // Depth của node này
                    type: metaMap[key].type 
                });
            }
            
            // Đệ quy xuống con (Value) -> Tăng depth lên 1
            flattenTreeWithDepth(node[key], metaMap, depth + 1, list);
        });
        return list;
    }

    // 3. String (Leaf node trong JSON, vd "dn1")
    if (typeof node === 'string') {
        const type = (metaMap && metaMap[node]) ? metaMap[node].type : 'leaf';
        list.push({ 
            id: node, 
            depth: depth, 
            type: type 
        });
    }

    return list;
}

// --- [FIXED] STRICT SAME-DEPTH NAVIGATION ---
function getSameDepthNavigation(structure, currentId, metaMap) {
    // 1. Ép phẳng cây
    const flatList = flattenTreeWithDepth(structure, metaMap);
    
    // 2. Tìm vị trí hiện tại
    const currentIndex = flatList.findIndex(item => item.id === currentId);
    if (currentIndex === -1) return { prev: null, next: null };

    const currentItem = flatList[currentIndex];
    let prev = null;
    let next = null;

    // 3. Tìm Next: Quét về phía sau
    for (let i = currentIndex + 1; i < flatList.length; i++) {
        const candidate = flatList[i];
        
        // [QUAN TRỌNG] Chỉ chấp nhận node CÙNG ĐỘ SÂU (Strict Cousin/Sibling)
        // Bỏ qua con cháu (depth > current)
        // Bỏ qua cha chú (depth < current) - Đây là thay đổi để fix lỗi minor -> vinaya
        if (candidate.depth === currentItem.depth) {
            next = candidate.id;
            break; 
        }
        
        // Nếu gặp node cạn hơn (depth < current), nghĩa là đã hết nhánh hiện tại và leo lên nhánh trên.
        // Với logic Strict Cousin, ta tiếp tục quét để tìm nhánh con của nhánh trên (cousin) 
        // chứ không dừng lại ở cha.
    }

    // 4. Tìm Prev: Quét về phía trước
    for (let i = currentIndex - 1; i >= 0; i--) {
        const candidate = flatList[i];
        if (candidate.depth === currentItem.depth) {
            prev = candidate.id;
            break;
        }
    }

    return { prev, next };
}

// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId, metaMap = {}) {
    const currentMeta = metaMap[currentId];
    // Check type: branch hoặc root đều dùng logic điều hướng theo cấu trúc cây
    const isBranch = currentMeta && (currentMeta.type === 'branch' || currentMeta.type === 'root');

    if (isBranch) {
        // Sử dụng logic mới: Strict Same-Depth (Cousin)
        const nav = getSameDepthNavigation(structure, currentId, metaMap);
        return { ...nav, type: 'branch' };
    }

    // Leaf Logic (Giữ nguyên)
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }
    
    // Subleaf Fallback (Giữ nguyên)
    const subleaf = getSubleafNavigation(structure, currentId);
    if (subleaf) return subleaf;

    return { prev: null, next: null };
}