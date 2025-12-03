// Path: web/assets/modules/loader.js
import { PRIMARY_BOOKS } from './constants.js';

export const SuttaLoader = (function () {
  const loadedFiles = new Set();

  function loadScript(fileName) {
    return new Promise((resolve, reject) => {
      if (loadedFiles.has(fileName)) return resolve();

      const script = document.createElement("script");
      // Trỏ vào thư mục books mới
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
    // window.ALL_SUTTA_FILES được load từ file sutta_loader.js (Global script)
    if (!window.ALL_SUTTA_FILES) return null;
    return window.ALL_SUTTA_FILES.find(
      (f) => f === `${bookId}.js` || f.endsWith(`/${bookId}.js`) || f.includes(`_${bookId}_book.js`) || f.includes(`/${bookId}_book.js`)
    );
  }

  return {
    loadBook: function (bookId) {
      const fileName = getFileNameForBook(bookId);
      if (fileName) return loadScript(fileName);
      return Promise.resolve();
    },

    initSmartLoading: async function () {
      if (!window.ALL_SUTTA_FILES) {
        console.warn("Manifest missing, waiting...");
        return;
      }

      console.log("🚀 Starting Smart Loading...");
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      const bookParam = params.get("b");
      
      let criticalFiles = new Set();

      if (queryId) {
        // [FIX] Thêm \- vào regex để bắt được ID dạng "pli-tv-kd"
        const match = queryId.match(/^[a-z\-]+/i); 
        if (match) {
            const bookId = match[0];
            const f = getFileNameForBook(bookId);
            if (f) criticalFiles.add(f);
        }
      }

      if (bookParam) {
        bookParam.split(",").forEach((b) => {
          const f = getFileNameForBook(b.trim());
          if (f) criticalFiles.add(f);
        });
      }

      // Load Super Book
      const superBook = window.ALL_SUTTA_FILES.find(f => f.includes("super_book.js"));
      if(superBook) criticalFiles.add(superBook);

      // Nếu không có yêu cầu cụ thể, load Primary Books ngay
      if (criticalFiles.size <= 1) { 
         PRIMARY_BOOKS.forEach(bookId => {
             const f = getFileNameForBook(bookId);
             if (f) criticalFiles.add(f);
         });
      }

      await Promise.all(Array.from(criticalFiles).map(loadScript));
      console.log("✅ Critical files loaded.");

      setTimeout(async () => {
        console.log("⏳ Background loading remaining files...");
        const remaining = window.ALL_SUTTA_FILES.filter(
          (f) => !loadedFiles.has(f)
        );
        for (const file of remaining) {
          await loadScript(file);
          await new Promise((r) => setTimeout(r, 50)); 
        }
        console.log("✅ All library loaded.");
      }, 2000);
    },
  };
})();