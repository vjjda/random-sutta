// Path: web/assets/modules/utils/navigator_logic.js

// --- 1. HELPERS CHUNG ---

function isSubleafContainer(node) {
    // Nhận diện object subleaf: { "key": ["item1", "item2"] }
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

function getIdFromNode(node) {
    if (typeof node === 'string') return node;
    if (isSubleafContainer(node)) return Object.keys(node)[0];
    return null;
}

// --- 2. LOGIC LEAF/SUBLEAF (Linear Flattening) ---
// Tạo ra một danh sách phẳng lì chứa tất cả mọi thứ có thể đọc được
function getFlatReadingList(structure) {
    let list = [];

    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            // Nếu là Subleaf Container (VD: an1.1-10 chứa an1.1...)
            if (isSubleafContainer(node)) {
                const parentId = Object.keys(node)[0];
                list.push(parentId); // Thêm cha vào list (để an1.1 prev về được an1.1-10)
                
                // Thêm các con
                const children = node[parentId];
                if (Array.isArray(children)) {
                    children.forEach(child => list.push(child));
                }
            } else {
                // Branch bình thường -> Chỉ duyệt con, không add bản thân Branch vào Reading List
                Object.values(node).forEach(child => traverse(child));
            }
        }
    }

    traverse(structure);
    return list;
}

// --- 3. LOGIC BRANCH (Hierarchical Cousin) ---
// Tìm Next/Prev cho Branch dựa trên cấu trúc cây
function getBranchNavigation(structure, currentId) {
    // Helper tìm đường dẫn đến Branch
    function findBranchPath(node, target, path = []) {
        if (typeof node === 'object' && node !== null) {
            // Nếu node là array (danh sách con của branch)
            if (Array.isArray(node)) {
                // Branch không nằm trong array (trừ phi cấu trúc dị), thường nằm trong keys của object
                for (const item of node) {
                     // Nếu item là string hoặc subleaf -> Bỏ qua (đây là leaf level)
                     if (typeof item === 'string' || isSubleafContainer(item)) continue;
                     // Recurse nếu item là object branch con
                     const res = findBranchPath(item, target, path);
                     if (res) return res;
                }
            } else {
                // Node là Object { key: value }
                const keys = Object.keys(node);
                for (const key of keys) {
                    if (key === target) return { path, container: node, key }; // Found!
                    
                    // Recurse down
                    const res = findBranchPath(node[key], target, [...path, { node, key }]);
                    if (res) return res;
                }
            }
        }
        return null;
    }

    const found = findBranchPath(structure, currentId);
    if (!found) return { prev: null, next: null };

    const { path, container, key: currentKey } = found;
    const keys = Object.keys(container);
    const idx = keys.indexOf(currentKey);

    let prevId = null;
    let nextId = null;

    // A. Tìm Sibling (Anh em cùng cha)
    if (idx > 0) prevId = keys[idx - 1];
    if (idx < keys.length - 1) nextId = keys[idx + 1];

    // B. Logic Cousin (Leo thang)
    // Nếu không có Next -> Leo lên cha -> Tìm Next của cha -> Lấy con đầu lòng của ông Next đó
    if (!nextId && path.length > 0) {
        const parentContext = path[path.length - 1]; // { node: parentContainer, key: parentKey }
        // Đệ quy tìm Nav của Parent
        const parentNav = getBranchNavigation(structure, parentContext.key);
        
        if (parentNav.next) {
            // Tìm thấy ông chú (Next của Bố)
            // Giờ phải tìm "Con đầu lòng" của ông chú này
            const uncleNode = findNodeByKey(structure, parentNav.next); // Hàm helper tìm node object
            if (uncleNode) {
                const firstChild = getFirstBranchChild(uncleNode);
                if (firstChild) nextId = firstChild;
            }
        }
    }

    // Logic Prev Cousin tương tự (Leo lên cha -> Prev của cha -> Con út của ông Prev đó)
    if (!prevId && path.length > 0) {
        const parentContext = path[path.length - 1];
        const parentNav = getBranchNavigation(structure, parentContext.key);
        
        if (parentNav.prev) {
            const uncleNode = findNodeByKey(structure, parentNav.prev);
            if (uncleNode) {
                const lastChild = getLastBranchChild(uncleNode);
                if (lastChild) prevId = lastChild;
            }
        }
    }

    return { prev: prevId, next: nextId, type: 'branch' };
}

// --- Helpers cho Branch Nav ---
function findNodeByKey(structure, targetKey) {
    if (typeof structure !== 'object' || structure === null) return null;
    if (structure[targetKey]) return structure[targetKey];
    
    for (const key in structure) {
        const res = findNodeByKey(structure[key], targetKey);
        if (res) return res;
    }
    return null;
}

function getFirstBranchChild(node) {
    if (typeof node !== 'object' || node === null) return null;
    if (Array.isArray(node)) return null; // Branch chứa array leaf -> Dừng
    const keys = Object.keys(node);
    if (keys.length > 0 && !['meta', 'isBranch'].includes(keys[0])) return keys[0];
    return null;
}

function getLastBranchChild(node) {
    if (typeof node !== 'object' || node === null) return null;
    if (Array.isArray(node)) return null;
    const keys = Object.keys(node).filter(k => !['meta', 'isBranch'].includes(k));
    if (keys.length > 0) return keys[keys.length - 1];
    return null;
}

// --- 4. MAIN EXPORT ---

export function calculateNavigation(structure, currentId) {
    // Strategy Pattern:
    // Bước 1: Thử tìm trong danh sách đọc phẳng (Reading Mode)
    // Dành cho Leaf, Subleaf, Subleaf-Parent
    const flatList = getFlatReadingList(structure);
    const flatIndex = flatList.indexOf(currentId);

    if (flatIndex !== -1) {
        return {
            prev: flatIndex > 0 ? flatList[flatIndex - 1] : null,
            next: flatIndex < flatList.length - 1 ? flatList[flatIndex + 1] : null,
            type: 'leaf'
        };
    }

    // Bước 2: Nếu không thấy trong flat list -> Chắc chắn là Branch
    // Dùng logic Cousin
    return getBranchNavigation(structure, currentId);
}