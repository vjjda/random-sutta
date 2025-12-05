// Path: web/assets/modules/loader.js
import { PRIMARY_BOOKS } from './constants.js';
// [NEW] Import danh sách file từ module auto-generated
import { FILE_INDEX } from './file_index.js';

export const SuttaLoader = (function () {
  const loadedFiles = new Set();
  // Sử dụng biến cục bộ thay vì global window.ALL_SUTTA_FILES
  const ALL_SUTTA_FILES = FILE_INDEX;

  function loadScript(fileName) {
    return new Promise((resolve, reject) => {
      if (loadedFiles.has(fileName)) return resolve();
      const script = document.createElement("script");
      script.src = `assets/books/${fileName}`; 
      script.async = true;
      script.onload = () => {
        loadedFiles.add(fileName);
        console.log(`📦 Loaded: ${fileName}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`❌ Failed to load: ${fileName}`);
        resolve(); 
      };
      document.head.appendChild(script);
    });
  }

  function getFileNameForBook(bookId) {
    if (!ALL_SUTTA_FILES) return null;
    return ALL_SUTTA_FILES.find(
      (f) => f === `${bookId}.js` || f.endsWith(`/${bookId}.js`) || f.includes(`_${bookId}_book.js`) || f.includes(`/${bookId}_book.js`)
    );
  }

  function findBookFileFromSuttaId(suttaId) {
      if (!ALL_SUTTA_FILES || !suttaId) return null;
      
      const cleanId = suttaId.toLowerCase().trim();
      let bestMatchFile = null;
      let maxLen = 0;

      ALL_SUTTA_FILES.forEach(filePath => {
          const baseName = filePath.split('/').pop().replace('_book.js', '').replace('.js', '');
          
          if (cleanId.startsWith(baseName)) {
              if (baseName.length > maxLen) {
                  maxLen = baseName.length;
                  bestMatchFile = filePath;
              }
          }
      });
      return bestMatchFile;
  }

  return {
    findBookFileFromSuttaId: findBookFileFromSuttaId,

    loadBook: function (bookId) {
      const fileName = getFileNameForBook(bookId);
      if (fileName) return loadScript(fileName);
      return Promise.resolve();
    },

    initSmartLoading: async function () {
      if (!ALL_SUTTA_FILES) {
        console.warn("Index missing, waiting...");
        return;
      }

      console.log("🚀 Starting Smart Loading...");
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      const bookParam = params.get("b");
      
      let criticalFiles = new Set();
      let hasTargetBook = false;

      if (queryId) {
        const f = findBookFileFromSuttaId(queryId);
        if (f) {
            criticalFiles.add(f);
            hasTargetBook = true;
        }
      }

      if (bookParam && !hasTargetBook) {
        bookParam.split(",").forEach((b) => {
          const f = getFileNameForBook(b.trim());
          if (f) criticalFiles.add(f);
        });
      }

      if (criticalFiles.size === 0) { 
         PRIMARY_BOOKS.forEach(bookId => {
             const f = getFileNameForBook(bookId);
             if (f) criticalFiles.add(f);
         });
      }
      
      const superBook = ALL_SUTTA_FILES.find(f => f.includes("super_book.js"));
      if(superBook) criticalFiles.add(superBook);

      await Promise.all(Array.from(criticalFiles).map(loadScript));
      console.log("✅ Critical files loaded.");

      setTimeout(async () => {
        console.log("⏳ Background loading remaining files...");
        const remaining = ALL_SUTTA_FILES.filter(
          (f) => !loadedFiles.has(f)
        );
        for (const file of remaining) {
           loadScript(file); 
        }
      }, 2000);
    },
  };
})();