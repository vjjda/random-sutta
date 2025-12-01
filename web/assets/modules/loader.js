// Path: web/assets/modules/loader.js
window.SuttaLoader = (function () {
  const loadedFiles = new Set();

  // Helper: Tải 1 file script
  function loadScript(fileName) {
    return new Promise((resolve, reject) => {
      if (loadedFiles.has(fileName)) return resolve();

      const script = document.createElement("script");
      script.src = `assets/sutta/books/${fileName}`;
      script.async = true;

      script.onload = () => {
        loadedFiles.add(fileName);
        console.log(`📦 Loaded: ${fileName}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`❌ Failed to load: ${fileName}`);
        resolve(); // Resolve để không chặn Promise.all
      };
      document.head.appendChild(script);
    });
  }

  // Helper: Tìm tên file từ bookId (ví dụ "mn" -> "mn.js")
  function getFileNameForBook(bookId) {
    if (!window.ALL_SUTTA_FILES) return null;
    return window.ALL_SUTTA_FILES.find(
      (f) => f === `${bookId}.js` || f.endsWith(`/${bookId}.js`)
    );
  }

  return {
    // API: Tải một book cụ thể theo yêu cầu
    loadBook: function (bookId) {
      const fileName = getFileNameForBook(bookId);
      if (fileName) return loadScript(fileName);
      return Promise.resolve();
    },

    // API: Logic tải thông minh ban đầu
    initSmartLoading: async function () {
      if (!window.ALL_SUTTA_FILES) {
        throw new Error("Manifest missing");
      }

      console.log("🚀 Starting Smart Loading...");
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      const bookParam = params.get("b");
      
      let criticalFiles = new Set();

      // 1. Phân tích Critical Path
      if (queryId) {
        const bookId = queryId.match(/^[a-z]+/)[0];
        const f = getFileNameForBook(bookId);
        if (f) criticalFiles.add(f);
      }

      if (bookParam) {
        bookParam.split(",").forEach((b) => {
          const f = getFileNameForBook(b.trim());
          if (f) criticalFiles.add(f);
        });
      }

      if (criticalFiles.size === 0) {
        window.PRIMARY_BOOKS.forEach((b) => {
          const f = getFileNameForBook(b);
          if (f) criticalFiles.add(f);
        });
      }

      // 2. Tải Critical Files
      await Promise.all(Array.from(criticalFiles).map(loadScript));
      console.log("✅ Critical files loaded.");

      // 3. Tải Background (Lazy Load)
      setTimeout(async () => {
        console.log("⏳ Background loading remaining files...");
        const remaining = window.ALL_SUTTA_FILES.filter(
          (f) => !loadedFiles.has(f)
        );
        for (const file of remaining) {
          await loadScript(file);
          await new Promise((r) => setTimeout(r, 50)); // Delay nhẹ
        }
        console.log("✅ All library loaded.");
      }, 2000);
    },
  };
})();