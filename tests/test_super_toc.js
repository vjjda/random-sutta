// tests/test_super_toc.js
import { SuttaService } from '../web/assets/modules/services/sutta_service.js';
import { SuttaRepository } from '../web/assets/modules/data/sutta_repository.js'; // To mock
import { SuttaExtractor } from '../web/assets/modules/data/sutta_extractor.js';

// Mock SuttaRepository.fetchMeta
SuttaRepository.fetchMeta = async (bookId) => {
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

SuttaRepository.resolveLocation = async (uid) => {
    if (uid.startsWith("an1")) return ["an1", 0];
    if (uid.startsWith("an2")) return ["an2", 0];
    if (uid.startsWith("an")) return ["an", 0]; // For an itself
    if (uid.startsWith("dhp")) return ["dhp", 0];
    return null;
};

// Mock SuttaRepository.fetchContentChunk to return dummy data,
// preventing calls to browser-specific APIs like window.location.protocol
SuttaRepository.fetchContentChunk = async (bookId, chunkIdx) => {
    // Return a dummy content object with a key that loadSutta expects for content extraction
    const dummyContent = {};
    if (bookId === "an1" && chunkIdx === 0) {
        dummyContent["an1.1"] = { "0": "Dummy AN1.1 content" };
        dummyContent["an1.2"] = { "0": "Dummy AN1.2 content" };
    }
    // Add more dummy content as needed for specific test cases
    return dummyContent;
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
    const result = await SuttaService.loadSutta("an", { prefetchNav: false });

    // Expect the tree to be the merged super_toc
    if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.an) throw new Error("Expected 'an' key in tree");
    if (result.tree.an.length !== 3) throw new Error(`Expected 3 children in 'an' tree, got ${result.tree.an.length}`);
    
    // Check if an1 and an2 are expanded into their full trees
    const an1Entry = result.tree.an.find(node => node.an1);
    if (!an1Entry || !an1Entry.an1["an1.1-10"]) throw new Error("Expected an1 tree to be merged");
    
    const an2Entry = result.tree.an.find(node => node.an2);
    if (!an2Entry || !an2Entry.an2["an2.1-10"]) throw new Error("Expected an2 tree to be merged");

    // Check merged meta
    if (!result.contextMeta || !result.contextMeta.an1 || !result.contextMeta.an2) {
        throw new Error("Expected meta for an1 and an2 in contextMeta");
    }
    if (result.contextMeta.an1.acronym !== "AN1") throw new Error("Incorrect an1 meta");
    if (result.contextMeta.an2.acronym !== "AN2") throw new Error("Incorrect an2 meta");
}

async function testSubBookTocGeneration() {
    const result = await SuttaService.loadSutta("an1.1", { prefetchNav: false });

    // Expect the tree to be the merged super_toc (same as for "an")
    if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.an) throw new Error("Expected 'an' key in tree");
    if (result.tree.an.length !== 3) throw new Error(`Expected 3 children in 'an' tree, got ${result.tree.an.length}`);
    
    const an1Entry = result.tree.an.find(node => node.an1);
    if (!an1Entry || !an1Entry.an1["an1.1-10"]) throw new Error("Expected an1 tree to be merged");

    // Check current UID
    if (result.uid !== "an1.1") throw new Error(`Expected uid to be an1.1, got ${result.uid}`);

    // Check merged meta
    if (!result.contextMeta || !result.contextMeta.an1 || !result.contextMeta.an2) {
        throw new Error("Expected meta for an1 and an2 in contextMeta");
    }
}

async function testBookTypeTocGeneration() {
    const result = await SuttaService.loadSutta("dhp1", { prefetchNav: false });

    // Expect the tree to be the original book's tree
    if (!result || !result.tree) throw new Error("Result or tree is null");
    if (!result.tree.dhp) throw new Error("Expected 'dhp' key in tree");
    if (result.tree.dhp.length !== 1) throw new Error(`Expected 1 child in 'dhp' tree, got ${result.tree.dhp.length}`);
    
    // Check original meta (only dhp and dhp1)
    if (!result.contextMeta || !result.contextMeta.dhp || !result.contextMeta.dhp1) {
        throw new Error("Expected meta for dhp and dhp1 in contextMeta");
    }
    if (result.contextMeta.an1 || result.contextMeta.an2) {
        throw new Error("Did not expect an1 or an2 meta for book type");
    }
}


// Run all tests
(async () => {
    // SuttaService.init() is usually called once. Mocking is enough for these tests.
    // await SuttaService.init(); // Not needed as we mock fetchMeta
    
    await runTest("Super Book TOC Generation", testSuperBookTocGeneration);
    await runTest("Sub Book TOC Generation", testSubBookTocGeneration);
    await runTest("Regular Book TOC Generation", testBookTypeTocGeneration);
})();
