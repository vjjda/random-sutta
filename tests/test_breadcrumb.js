// Path: tests/test_breadcrumb.js
// Mocking the required modules for a Node.js environment
const BreadcrumbRenderer = {
    findPath(structure, targetUid, currentPath = []) {
        if (!structure) return null;
        if (typeof structure === 'string') {
            return structure === targetUid ? [...currentPath, structure] : null;
        }
        if (Array.isArray(structure)) {
            for (const child of structure) {
                const result = this.findPath(child, targetUid, currentPath);
                if (result) return result;
            }
            return null;
        }
        if (typeof structure === 'object' && structure !== null) {
            for (const key in structure) {
                const newPath = [...currentPath, key];
                if (key === targetUid) return newPath;
                const result = this.findPath(structure[key], targetUid, newPath);
                if (result) return result;
            }
        }
        return null;
    }
};

// The corrected logic under test (from MagicNav.render)
function calculateFullPath(localTree, currentUid, superTree) {
    let fullPath = BreadcrumbRenderer.findPath(localTree, currentUid);
    
    // --- CORRECTED LOGIC START ---
    if (fullPath && superTree && fullPath.length > 0) {
        const rootBookId = fullPath[0]; // e.g., "an1" from ["an1", "an1.1-10", "an1.5"]
        
        // Find the path to this rootBookId within the superTree (e.g., ["tipitaka", "sutta", "an", "an1"])
        const superPath = BreadcrumbRenderer.findPath(superTree, rootBookId);
        
        if (superPath && superPath.length > 0) {
            // If the superPath's last element is the same as the localPath's first element,
            // remove it to avoid duplication when concatenating.
            // e.g., superPath ["...", "an1"] and fullPath ["an1", "..."]. Remove "an1" from superPath.
            if (superPath[superPath.length - 1] === rootBookId) {
                superPath.pop(); 
            }
            fullPath = [...superPath, ...fullPath];
        }
    }
    // --- CORRECTED LOGIC END ---
    
    return fullPath;
}

// Test Data
const localTree = {
    "an1": {
        "an1.1-10": ["an1.1", "an1.5", "an1.10"]
    }
};

const superTree = {
    "tipitaka": {
        "sutta": {
            "an": ["an1"]
        }
    }
};

// Test Case 1: Root Node (an1)
// Expected: [tipitaka, sutta, an, an1]
console.log("--- Test Case 1: Root Node (an1) ---");
const path1 = calculateFullPath(localTree, "an1", superTree);
console.log("Path:", path1);
if (path1 && path1[0] === 'tipitaka' && path1.includes('an1')) {
    console.log("PASS");
} else {
    console.log("FAIL: Expected path to start with 'tipitaka' and contain 'an1' for root node");
}

// Test Case 2: Leaf Node (an1.5)
// Expected: [tipitaka, sutta, an, an1, an1.1-10, an1.5]
console.log("\n--- Test Case 2: Leaf Node (an1.5) ---");
const path2 = calculateFullPath(localTree, "an1.5", superTree);
console.log("Path:", path2);
if (path2 && path2[0] === 'tipitaka' && path2.includes('an1') && path2.includes('an1.5')) {
    console.log("PASS");
} else {
    console.log("FAIL: Expected path to start with 'tipitaka', contain 'an1' and 'an1.5' for leaf node");
}

console.log("\n--- Summary ---");
if (path1 && path1[0] === 'tipitaka' && path2 && path2[0] === 'tipitaka') {
    console.log("All tests PASSED with corrected logic.");
} else {
    console.log("Some tests FAILED - Review the corrected logic.");
}