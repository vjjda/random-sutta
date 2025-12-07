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
            // [FIXED] Luôn duyệt sâu vào values thay vì chặn ở container
            // Điều này giúp tìm thấy "dn" nằm trong { "long": ["dn"] }
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

// --- LOGIC BRANCH (FIXED: ARRAY & COUSIN SUPPORT) ---
function getBranchSiblings(structure, branchId) {
    // Helper: Tìm danh sách anh em chứa branchId
    function findSiblingGroup(node) {
        if (!node) return null;

        // Trường hợp 1: Node là Mảng (Array) - Thường gặp trong Super Tree
        if (Array.isArray(node)) {
            // Bước A: Gom nhóm "Virtual Siblings" (Key của các object con trong mảng)
            // Ví dụ: [{long:...}, {middle:...}] -> ['long', 'middle']
            let virtualKeys = [];
            for (const item of node) {
                if (typeof item === 'string') {
                    virtualKeys.push(item);
                } else if (typeof item === 'object' && item !== null) {
                    const keys = Object.keys(item).filter(k => k !== 'meta' && k !== 'isBranch');
                    virtualKeys.push(...keys);
                }
            }

            if (virtualKeys.includes(branchId)) {
                return virtualKeys;
            }

            // Bước B: Đệ quy xuống con
            for (const item of node) {
                if (typeof item === 'object' && item !== null) {
                    // Dive vào values (vì item thường là wrapper {key: val})
                    for (const val of Object.values(item)) {
                        const res = findSiblingGroup(val);
                        if (res) return res;
                    }
                }
            }
        }
        
        // Trường hợp 2: Node là Object thông thường
        else if (typeof node === 'object') {
            const keys = Object.keys(node).filter(k => k !== 'meta' && k !== 'isBranch');
            if (keys.includes(branchId)) {
                return keys;
            }

            for (const key of keys) {
                const res = findSiblingGroup(node[key]);
                if (res) return res;
            }
        }

        return null;
    }

    const siblings = findSiblingGroup(structure);

    if (!siblings) {
        // console.warn(`[NavLogic] No container found for branch: ${branchId}`);
        return { prev: null, next: null };
    }

    const idx = siblings.indexOf(branchId);
    
    return {
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx < siblings.length - 1 ? siblings[idx + 1] : null
    };
}


// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId) {
    // 1. Subleaf Check
    const subleafNav = getSubleafNavigation(structure, currentId);
    if (subleafNav) return subleafNav;

    // 2. Leaf (Reading Mode)
    // [NOTE] getLeafList mới sẽ tìm thấy 'dn', 'mn' trong super_struct vì nó duyệt sâu
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }

    // 3. Branch (Browsing Mode)
    // Dành cho các ID là Key (Group) như 'long', 'middle'
    const branchNav = getBranchSiblings(structure, currentId);
    return { ...branchNav, type: 'branch' };
}