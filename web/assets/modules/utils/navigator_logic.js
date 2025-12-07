// Path: web/assets/modules/utils/navigator_logic.js

function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

// ... (getLeafList và getSubleafNavigation giữ nguyên vì đã ổn) ...
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

function getSubleafNavigation(structure, currentId) {
    // ... (Giữ nguyên logic subleaf cũ) ...
    // Để ngắn gọn tôi không paste lại đoạn logic subleaf đã đúng
    // Bạn giữ nguyên code phần này từ version trước
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

// [DEBUG LOG ADDED HERE]
function getBranchSiblings(structure, branchId) {
    console.log(`[NavLogic] searching branch siblings for: ${branchId}`);
    let siblings = null;

    function traverse(node, depth = 0) {
        if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
            // Check if node contains branchId
            if (Object.prototype.hasOwnProperty.call(node, branchId)) {
                console.log(`[NavLogic] Found container at depth ${depth}. Keys:`, Object.keys(node));
                siblings = Object.keys(node).filter(k => k !== 'meta' && k !== 'isBranch');
                return true; 
            }

            // Recurse
            for (const key in node) {
                const child = node[key];
                // Skip leaves/subleaves to focus on branch structure
                if (typeof child === 'object' && child !== null && !Array.isArray(child) && !isSubleafContainer(child)) {
                    if (traverse(child, depth + 1)) return true;
                }
            }
        }
        return false;
    }

    traverse(structure);

    if (!siblings) {
        console.warn(`[NavLogic] No container found for branch: ${branchId}`);
        return { prev: null, next: null };
    }

    const idx = siblings.indexOf(branchId);
    console.log(`[NavLogic] Index of ${branchId} is ${idx} in`, siblings);
    
    return {
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx < siblings.length - 1 ? siblings[idx + 1] : null
    };
}

export function calculateNavigation(structure, currentId) {
    // 1. Subleaf
    const subleafNav = getSubleafNavigation(structure, currentId);
    if (subleafNav) {
        console.log(`[NavLogic] Type: Subleaf. Prev=${subleafNav.prev}, Next=${subleafNav.next}`);
        return subleafNav;
    }

    // 2. Leaf
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        const prev = leafIdx > 0 ? leafList[leafIdx - 1] : null;
        const next = leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null;
        console.log(`[NavLogic] Type: Leaf. Prev=${prev}, Next=${next}`);
        return { prev, next, type: 'leaf' };
    }

    // 3. Branch
    const branchNav = getBranchSiblings(structure, currentId);
    console.log(`[NavLogic] Type: Branch. Prev=${branchNav.prev}, Next=${branchNav.next}`);
    return { ...branchNav, type: 'branch' };
}