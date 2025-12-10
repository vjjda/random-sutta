// tests/test_super_toc.js
// Mock global objects for Node.js environment
if (typeof window === 'undefined') {
    global.window = {
        location: { protocol: 'http:' }
    };
}

// Unconditionally mock localStorage to ensure tests control the state
global.localStorage = {
    _store: {},
    getItem: function(key) { return this._store[key] || null; },
    setItem: function(key, value) { this._store[key] = value.toString(); },
    removeItem: function(key) { delete this._store[key]; },
    clear: function() { this._store = {}; }
};

import { SuttaService } from '../web/assets/modules/services/sutta_service.js';
import { SuttaRepository } from '../web/assets/modules/data/sutta_repository.js'; // To mock
import { SuttaExtractor } from '../web/assets/modules/data/sutta_extractor.js';

// ... (Existing SuttaRepository mocks) ...
// Mock SuttaRepository.fetchMeta
SuttaRepository.fetchMeta = async (bookId) => {
// ... (Existing mock content) ...
    const mockData = {
        "an": {
            type: "super_book",
            meta: {
                "an": { acronym: "AN", original_title: "Anguttara Nikaya" }
            },
            tree: {
                "an": ["an1", "an2", "an3"]
            }
        },
        "an1": {
            type: "sub_book",
            super_book_id: "an",
            meta: {
                "an1": { acronym: "AN1", original_title: "Book of the Ones" },
                "an1.1": { acronym: "AN1.1", original_title: "First Sutta" },
                "an1.2": { acronym: "AN1.2", original_title: "Second Sutta" }
            },
            tree: {
                "an1": {
                    "an1.1-10": ["an1.1", "an1.2"]
                }
            }
        },
        "an2": {
            type: "sub_book",
            super_book_id: "an",
            meta: {
                "an2": { acronym: "AN2", original_title: "Book of the Twos" },
                "an2.1": { acronym: "AN2.1", original_title: "Two-sutta 1" }
            },
            tree: {
                "an2": {
                    "an2.1-10": ["an2.1"]
                }
            }
        },
        "dhp": {
            type: "book",
            meta: {
                "dhp": { acronym: "DHP", original_title: "Dhammapada" },
                "dhp1": { acronym: "DHP1", original_title: "Verse 1" }
            },
            tree: {
                "dhp": ["dhp1"]
            }
        },
        "tpk": { // SuperMeta for general navigation
            type: "super_container",
            meta: {
                "tpk": { acronym: "TPK", original_title: "Tipitaka" }
            },
            tree: {
                "tipitaka": ["sutta"]
            }
        }
    };
    return mockData[bookId] || null;
};

// Mock SuttaRepository.resolveLocation
SuttaRepository.resolveLocation = async (uid) => {
    if (uid.startsWith("an1")) return ["an1", 0];
    if (uid.startsWith("an2")) return ["an2", 0];
    if (uid.startsWith("an")) return ["an", 0];
    if (uid.startsWith("dhp")) return ["dhp", 0];
    return null;
};

// Mock SuttaRepository.fetchContentChunk
SuttaRepository.fetchContentChunk = async (bookId, chunkIdx) => {
    return { [bookId + ".1"]: "dummy content" };
};

// Mock SuttaExtractor.extract (not directly tested here, but used by loadSutta)
SuttaExtractor.extract = (content, key) => `Extracted content for ${key}`;

async function runTest(name, testFunction) {
    console.log(`--- Running Test: ${name} ---`);
    try {
        await testFunction();
        console.log(`✅ Test PASSED: ${name}`);
    } catch (error) {
        console.error(`❌ Test FAILED: ${name}`);
        console.error(error);
    }
    console.log("\n");
}

async function testSuperBookTocGeneration() {
    // Setup: Simulate Offline Ready
    localStorage.setItem('sutta_offline_version', 'v1');

    const result = await SuttaService.loadSutta("an", { prefetchNav: false });
    // ... (Existing assertions) ...
    if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.an) throw new Error("Expected 'an' key in tree");
    if (result.tree.an.length !== 3) throw new Error(`Expected 3 children in 'an' tree, got ${result.tree.an.length}`);
    
    // Check if an1 and an2 are expanded into their full trees
    const an1Entry = result.tree.an.find(node => node.an1);
    if (!an1Entry || !an1Entry.an1["an1.1-10"]) throw new Error("Expected an1 tree to be merged");
    
    const an2Entry = result.tree.an.find(node => node.an2);
    if (!an2Entry || !an2Entry.an2["an2.1-10"]) throw new Error("Expected an2 tree to be merged");
}

async function testSubBookTocGeneration() {
    // Setup: Simulate Offline Ready
    localStorage.setItem('sutta_offline_version', 'v1');

    const result = await SuttaService.loadSutta("an1.1", { prefetchNav: false });
    // ... (Existing assertions) ...
    if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.an) throw new Error("Expected 'an' key in tree");
    if (result.tree.an.length !== 3) throw new Error(`Expected 3 children in 'an' tree, got ${result.tree.an.length}`);
    
    const an1Entry = result.tree.an.find(node => node.an1);
    if (!an1Entry || !an1Entry.an1["an1.1-10"]) throw new Error("Expected an1 tree to be merged");
}

async function testBookTypeTocGeneration() {
    // Setup: Simulate Offline Ready (Shouldn't matter for regular book)
    localStorage.setItem('sutta_offline_version', 'v1');
    const result = await SuttaService.loadSutta("dhp1", { prefetchNav: false });
    // ... (Existing assertions) ...
     if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.dhp) throw new Error("Expected 'dhp' key in tree");
    if (result.tree.dhp.length !== 1) throw new Error(`Expected 1 child in 'dhp' tree, got ${result.tree.dhp.length}`);
}

async function testSuperTocFallback() {
    // Setup: Simulate Not Ready (Clean cache flag)
    localStorage.removeItem('sutta_offline_version');
    
    // Test Case: Load "an" (Super Book)
    const result = await SuttaService.loadSutta("an", { prefetchNav: false });

    if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.an) throw new Error("Expected 'an' key in tree");
    
    // Check that it is NOT merged
    const firstChild = result.tree.an[0];
    if (typeof firstChild !== 'string' || firstChild !== 'an1') {
        throw new Error(`Expected unmerged child 'an1', got ${JSON.stringify(firstChild)}`);
    }
    
    // Test Case: Load "an1.1" (Sub Book)
    const subResult = await SuttaService.loadSutta("an1.1", { prefetchNav: false });
    
    if (!subResult || !subResult.tree) throw new Error("Result or tree is null");
    
    if (!subResult.tree.an1) throw new Error("Expected 'an1' key in local fallback tree");
    if (subResult.tree.an) throw new Error("Did not expect 'an' key (Super Tree) in local fallback");
}

async function testBreadcrumbLazyLoad() {
    // Setup: Simulate Not Ready
    localStorage.removeItem('sutta_offline_version');
    
    // Load a book
    const resultNotReady = await SuttaService.loadSutta("an1", { prefetchNav: false });
    if (resultNotReady.superTree !== null) throw new Error("Expected superTree to be null when Not Ready");
    if (resultNotReady.superMeta !== null) throw new Error("Expected superMeta to be null when Not Ready");

    // Setup: Simulate Ready
    localStorage.setItem('sutta_offline_version', 'v1');
    
    // Load a book
    const resultReady = await SuttaService.loadSutta("an1", { prefetchNav: false });
    if (resultReady.superTree === null) throw new Error("Expected superTree to be present when Ready");
    if (resultReady.superMeta === null) throw new Error("Expected superMeta to be present when Ready");
    if (!resultReady.superTree.tipitaka) throw new Error("Invalid superTree structure");
}

// Run all tests
(async () => {
    await runTest("Super Book TOC Generation (Ready)", testSuperBookTocGeneration);
    await runTest("Sub Book TOC Generation (Ready)", testSubBookTocGeneration);
    await runTest("Regular Book TOC Generation", testBookTypeTocGeneration);
    await runTest("Super TOC Fallback (Not Ready)", testSuperTocFallback);
    await runTest("Breadcrumb Lazy Load", testBreadcrumbLazyLoad);
})();
