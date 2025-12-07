// Path: web/assets/modules/utils/navigator_logic.js

// --- 1. HELPERS ---

function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

// --- 2. LOGIC LEAF/SUBLEAF (Reading Mode) ---
function getLeafList(structure) {
    let list = [];
    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                list.push(Object.keys(node)[0]);
            } else {
                Object.values(node).forEach(child => traverse(child));
            }
        }
    }
    traverse(structure);
    return list;
}

// --- 3. LOGIC BRANCH (Browsing Mode - Fix cho Super Struct) ---
function getBranchSiblings(structure, branchId) {
    let siblings = null;

    function traverse(node) {
        if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
            // Check nếu node này chứa branchId
            if (Object.prototype.hasOwnProperty.call(node, branchId)) {
                // Lọc bỏ các key meta/isBranch nếu có (đề phòng data bẩn)
                siblings = Object.keys(node).filter(k => k !== 'meta' && k !== 'isBranch');
                return true; 
            }

            // Duyệt sâu vào các con
            for (const key in node) {
                // Chỉ duyệt tiếp nếu con là Object Branch (không phải Leaf Array hay Subleaf)
                const child = node[key];
                if (typeof child === 'object' && child !== null && !Array.isArray(child) && !isSubleafContainer(child)) {
                    if (traverse(child)) return true;
                }
            }
        }
        return false;
    }

    // Bắt đầu duyệt từ root structure
    traverse(structure);

    if (!siblings) return { prev: null, next: null };

    const idx = siblings.indexOf(branchId);
    return {
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx < siblings.length - 1 ? siblings[idx + 1] : null
    };
}

// --- 4. LOGIC SUBLEAF ---
function getSubleafNavigation(structure, currentId) {
    function findCtx(node) {
        if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                const parentId = Object.keys(node)[0];
                const children = node[parentId];
                if (children.includes(currentId)) {
                    return { parentId, children };
                }
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

    // Escalation
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

// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId) {
    // 1. Subleaf
    const subleafNav = getSubleafNavigation(structure, currentId);
    if (subleafNav) return subleafNav;

    // 2. Leaf (Reading)
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }

    // 3. Branch (Browsing)
    const branchNav = getBranchSiblings(structure, currentId);
    return { ...branchNav, type: 'branch' };
}