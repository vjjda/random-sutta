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
           console.warn("Manifest missing, waiting...");
           return; 
        }
        
        console.log("🚀 Starting Smart Loading...");
        const params = new URLSearchParams(window.location.search);
        const queryId = params.get("q");
        const bookParam = params.get("b");
        
        let criticalFiles = new Set();

        // 1. Phân tích Critical Path (Dựa trên URL)
        if (queryId) {
            const match = queryId.match(/^[a-z]+/);
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
        
        // Luôn tải super_book để có cấu trúc menu
        const superBook = window.ALL_SUTTA_FILES.find(f => f.includes("super_book.js"));
        if(superBook) criticalFiles.add(superBook);

        // [FIX QUAN TRỌNG]: Nếu không có file nào được yêu cầu cụ thể (Mở trang chủ)
        // Ta phải tải bộ Primary Books ngay lập tức để chức năng Random hoạt động.
        if (criticalFiles.size <= 1) { // <= 1 vì có thể đã add superBook
             if (window.PRIMARY_BOOKS) {
                 window.PRIMARY_BOOKS.forEach(bookId => {
                     const f = getFileNameForBook(bookId);
                     if (f) criticalFiles.add(f);
                 });
             }
        }

        // 2. Tải Critical Files (Lúc này đã bao gồm MN, DN, SN...)
        await Promise.all(Array.from(criticalFiles).map(loadScript));
        console.log("✅ Critical files loaded.");

        // 3. Lazy load phần còn lại (Các bộ phụ KN nhỏ lẻ)
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