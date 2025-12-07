// Path: web/assets/modules/utils/navigator_logic.js

export function calculateNavigation(structure, currentId) {
    // 1. Tìm đường dẫn (Path) từ Root đến Node chứa currentId
    // Path là mảng các context: [{ container, key, type }, ...]
    const path = findPath(structure, currentId);
    
    if (!path) return { prev: null, next: null };

    const currentContext = path[path.length - 1];
    let { container, key, type } = currentContext; // key có thể là index (nếu array) hoặc string key

    // 2. Tìm Sibling cơ bản (Cùng cấp)
    let prev = getSibling(container, key, -1);
    let next = getSibling(container, key, 1);

    // 3. Xử lý ESCALATION (Leo thang) cho Subleaf
    // Logic: Nếu đang ở trong một mảng con (Subleaf List) và chạm giới hạn -> Leo lên Parent
    
    if (type === 'array_item') {
        // Kiểm tra xem array này có phải là con của một Object Leaf (Range) không
        // Path mẫu: [..., {type: 'object_value', key: 'an1.1-10'}, {type: 'array_item', key: 0}]
        const parentContext = path[path.length - 2];

        if (parentContext && parentContext.type === 'object_value') {
            // --- PREV: Subleaf đầu -> Về Parent ---
            if (!prev) {
                // Parent Key chính là ID của bài gộp (VD: "an1.1-10")
                prev = parentContext.key; 
            }

            // --- NEXT: Subleaf cuối -> Về Sibling của Parent ---
            if (!next) {
                // Đệ quy: Tính Next của Parent (VD: Next của "an1.1-10")
                const parentNav = calculateNavigation(structure, parentContext.key);
                next = parentNav.next;
            }
        }
    }

    return { prev, next };
}

// --- HELPERS ---

function findPath(node, target, currentPath = []) {
    // 1. String Match (Leaf / Subleaf)
    if (typeof node === 'string') {
        return node === target ? currentPath : null;
    }

    // 2. Array: Duyệt index
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            const path = findPath(node[i], target, [...currentPath, { container: node, key: i, type: 'array_item' }]);
            if (path) return path;
        }
    }

    // 3. Object: Duyệt key
    if (typeof node === 'object' && node !== null) {
        for (const key of Object.keys(node)) {
            // Check nếu Key chính là Target (Trường hợp Branch/Parent ID)
            if (key === target) {
                return [...currentPath, { container: node, key: key, type: 'object_key' }];
            }

            // Recurse vào Value
            const path = findPath(node[key], target, [...currentPath, { container: node, key: key, type: 'object_value' }]);
            if (path) return path;
        }
    }

    return null;
}

function getSibling(container, currentKey, direction) {
    if (Array.isArray(container)) {
        // Container là Array -> Key là Index (number)
        const siblingItem = container[currentKey + direction];
        return siblingItem ? getIdFromItem(siblingItem) : null;
    } else {
        // Container là Object -> Key là String
        const keys = Object.keys(container);
        const idx = keys.indexOf(currentKey);
        if (idx === -1) return null;
        return keys[idx + direction] || null;
    }
}

function getIdFromItem(item) {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Nếu item là object { "an1.1-10": [...] }, ID là key đầu tiên
        return Object.keys(item)[0];
    }
    return null;
}