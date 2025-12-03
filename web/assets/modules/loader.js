// Path: web/assets/modules/loader.js
window.SuttaLoader = (function () {
  const loadedFiles = new Set();

  function loadScript(fileName) {
    return new Promise((resolve, reject) => {
      if (loadedFiles.has(fileName)) return resolve();

      const script = document.createElement("script");
      
      // [FIX] Sửa đường dẫn từ 'assets/sutta/books/' thành 'assets/books/'
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

  // ... (Phần còn lại giữ nguyên) ...

  function getFileNameForBook(bookId) {
    if (!window.ALL_SUTTA_FILES) return null;
    return window.ALL_SUTTA_FILES.find(
      (f) => f === `${bookId}.js` || f.endsWith(`/${bookId}.js`) || f.includes(`_${bookId}_book.js`) || f.includes(`/${bookId}_book.js`)
    );
  }

  return {
      // ... (Giữ nguyên)
      loadBook: function (bookId) {
        const fileName = getFileNameForBook(bookId);
        if (fileName) return loadScript(fileName);
        return Promise.resolve();
      },

      initSmartLoading: async function () {
        if (!window.ALL_SUTTA_FILES) {
           // Fallback nếu chưa load được manifest
           console.warn("Manifest missing, waiting...");
           return; 
        }
        // ... (Giữ nguyên logic cũ) ...
        // Chỉ cần đảm bảo logic loadScript ở trên đã sửa path
        
        console.log("🚀 Starting Smart Loading...");
        const params = new URLSearchParams(window.location.search);
        const queryId = params.get("q");
        const bookParam = params.get("b");
        
        let criticalFiles = new Set();

        // 1. Phân tích Critical Path
        if (queryId) {
            // Lấy phần chữ cái đầu (vd: mn20 -> mn)
            const match = queryId.match(/^[a-z]+/);
            if (match) {
                const bookId = match[0];
                const f = getFileNameForBook(bookId);
                if (f) criticalFiles.add(f);
            }
        }
        
        // ... (Logic cũ) ...
        // Tạm thời load các file quan trọng trước
        // Logic super_book.js nên được thêm vào đây nếu cần
        const superBook = window.ALL_SUTTA_FILES.find(f => f.includes("super_book.js"));
        if(superBook) criticalFiles.add(superBook);

        await Promise.all(Array.from(criticalFiles).map(loadScript));
        console.log("✅ Critical files loaded.");

        // Lazy load phần còn lại
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
      }
  };
})();