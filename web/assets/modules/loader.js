// Path: web/assets/modules/loader.js
import { PRIMARY_BOOKS } from './constants.js';

export const SuttaLoader = (function () {
  const loadedFiles = new Set();

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
      
      // Tập hợp các file bắt buộc phải có để render màn hình đầu tiên
      let criticalFiles = new Set();
      let hasTargetBook = false;

      // 1. Ưu tiên cao nhất: Sách được yêu cầu qua ?q=
      if (queryId) {
        // [Regex Update] Hỗ trợ cả sách có dấu gạch ngang (vinaya)
        const match = queryId.match(/^[a-z\-]+/i);
        if (match) {
            const bookId = match[0].toLowerCase();
            const f = getFileNameForBook(bookId);
            if (f) {
                criticalFiles.add(f);
                hasTargetBook = true;
            }
        }
      }

      // 2. Ưu tiên nhì: Sách được lọc qua ?b=
      if (bookParam && !hasTargetBook) {
        bookParam.split(",").forEach((b) => {
          const f = getFileNameForBook(b.trim());
          if (f) criticalFiles.add(f);
        });
      }

      // 3. Nếu KHÔNG có sách cụ thể nào được yêu cầu, mới tải bộ Primary
      // Logic cũ: if (criticalFiles.size <= 1) -> Luôn tải Primary
      // Logic mới: Chỉ tải Primary nếu hoàn toàn không biết người dùng muốn đọc gì
      if (criticalFiles.size === 0) { 
         PRIMARY_BOOKS.forEach(bookId => {
             const f = getFileNameForBook(bookId);
             if (f) criticalFiles.add(f);
         });
      }
      
      // Luôn load Super Book nếu có (để render menu cấu trúc)
      const superBook = window.ALL_SUTTA_FILES.find(f => f.includes("super_book.js"));
      if(superBook) criticalFiles.add(superBook);

      // Giai đoạn 1: Chặn luồng để tải Critical Files
      await Promise.all(Array.from(criticalFiles).map(loadScript));
      console.log("✅ Critical files loaded.");

      // Giai đoạn 2: Tải ngầm tất cả các file còn lại (bao gồm cả Primary Books nếu chưa tải)
      setTimeout(async () => {
        console.log("⏳ Background loading remaining files...");
        const remaining = window.ALL_SUTTA_FILES.filter(
          (f) => !loadedFiles.has(f)
        );
        
        // Tải tuần tự để đỡ chiếm băng thông, hoặc song song tùy ý
        // Ở đây dùng song song theo lô nhỏ hoặc song song toàn bộ vì browser tự giới hạn connection
        for (const file of remaining) {
           loadScript(file); // Không await để chạy song song "fire and forget"
        }
        
        // (Optional) Nếu muốn log khi HOÀN TẤT tất cả thì mới dùng Promise.all ở đây
        // Nhưng để tránh chiếm thread, ta cứ để nó tự chạy.
      }, 2000);
    },
  };
})();