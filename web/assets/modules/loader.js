// Path: web/assets/modules/loader.js
import { PRIMARY_BOOKS } from './constants.js';

export const SuttaLoader = (function () {
  const loadedFiles = new Set();

  function loadScript(fileName) {
    // ... (Giữ nguyên hàm này)
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
    // ... (Giữ nguyên hàm này)
    if (!window.ALL_SUTTA_FILES) return null;
    return window.ALL_SUTTA_FILES.find(
      (f) => f === `${bookId}.js` || f.endsWith(`/${bookId}.js`) || f.includes(`_${bookId}_book.js`) || f.includes(`/${bookId}_book.js`)
    );
  }

  // [NEW] Hàm tìm file sách dựa trên Sutta ID bất kỳ (Reverse Lookup)
  function findBookFileFromSuttaId(suttaId) {
      if (!window.ALL_SUTTA_FILES || !suttaId) return null;
      
      const cleanId = suttaId.toLowerCase().trim();
      let bestMatchFile = null;
      let maxLen = 0;

      // Duyệt qua tất cả các file sách đang có
      window.ALL_SUTTA_FILES.forEach(filePath => {
          // Trích xuất Book ID từ tên file
          // Ví dụ: "vinaya/pli-tv-bu-vb_book.js" -> "pli-tv-bu-vb"
          // Ví dụ: "sutta/mn_book.js" -> "mn"
          const baseName = filePath.split('/').pop().replace('_book.js', '').replace('.js', '');
          
          // Kiểm tra xem Sutta ID có bắt đầu bằng Book ID này không
          // Ví dụ: "pli-tv-bu-vb-pj1" startsWith "pli-tv-bu-vb" -> TRUE
          // Ví dụ: "mn1" startsWith "mn" -> TRUE
          if (cleanId.startsWith(baseName)) {
              // Chọn sách có tên dài nhất để chính xác nhất
              // (Tránh trường hợp 'pli-tv' khớp nhầm thay vì 'pli-tv-bu-vb')
              if (baseName.length > maxLen) {
                  maxLen = baseName.length;
                  bestMatchFile = filePath;
              }
          }
      });
      
      return bestMatchFile;
  }

  return {
    // Expose hàm tìm file để App dùng
    findBookFileFromSuttaId: findBookFileFromSuttaId,

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
      let hasTargetBook = false;

      // 1. Ưu tiên cao nhất: Sách chứa Sutta đang request
      if (queryId) {
        // [FIX] Dùng thuật toán tìm kiếm thông minh thay vì Regex đoán mò
        const f = findBookFileFromSuttaId(queryId);
        if (f) {
            criticalFiles.add(f);
            hasTargetBook = true;
        }
      }

      // 2. Ưu tiên nhì: Sách được lọc qua ?b=
      if (bookParam && !hasTargetBook) {
        bookParam.split(",").forEach((b) => {
          const f = getFileNameForBook(b.trim());
          if (f) criticalFiles.add(f);
        });
      }

      // 3. Fallback: Load Primary
      if (criticalFiles.size === 0) { 
         PRIMARY_BOOKS.forEach(bookId => {
             const f = getFileNameForBook(bookId);
             if (f) criticalFiles.add(f);
         });
      }
      
      const superBook = window.ALL_SUTTA_FILES.find(f => f.includes("super_book.js"));
      if(superBook) criticalFiles.add(superBook);

      await Promise.all(Array.from(criticalFiles).map(loadScript));
      console.log("✅ Critical files loaded.");

      setTimeout(async () => {
        console.log("⏳ Background loading remaining files...");
        const remaining = window.ALL_SUTTA_FILES.filter(
          (f) => !loadedFiles.has(f)
        );
        for (const file of remaining) {
           loadScript(file); 
        }
      }, 2000);
    },
  };
})();