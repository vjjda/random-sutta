// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", async () => {
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");

  // --- 1. SETUP UI HANDLERS (Giữ nguyên code cũ) ---
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");
  if (toggleDrawerBtn && filterDrawer) {
    toggleDrawerBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("hidden");
      toggleDrawerBtn.classList.toggle("open");
    });
  }
  const { hideComment } = window.initCommentPopup();

  // --- 2. CORE FUNCTIONS (Giữ nguyên) ---
  window.loadSutta = function (suttaId, shouldUpdateUrl = true) {
    hideComment();
    if (window.renderSutta(suttaId, false)) {
      if (shouldUpdateUrl) {
        const bookParam = window.generateBookParam();
        window.updateURL(suttaId, bookParam);
      }
    } else {
        // Nếu load thất bại (do file chưa tải xong), thử tải file tương ứng
        // Đây là fallback (dự phòng)
        const requiredBook = suttaId.match(/^[a-z]+/)[0]; // mn1 -> mn
        loadBookFile(requiredBook).then(() => {
             if (window.renderSutta(suttaId, false)) { /* Success */ }
        });
    }
  };

  // Hàm random sutta (Giữ nguyên logic filter)
  function loadRandomSutta(shouldUpdateUrl = true) {
     hideComment();
     if (!window.SUTTA_DB) return;
     // ... (Logic random giữ nguyên như cũ) ...
     // Copy lại đoạn logic random cũ vào đây
     const allKeys = Object.keys(window.SUTTA_DB);
     if (allKeys.length === 0) return;
 
     const activePrefixes = window.getActiveFilters();
     const filteredKeys = allKeys.filter((key) => {
       return activePrefixes.some((prefix) => {
         if (!key.startsWith(prefix)) return false;
         const nextChar = key.charAt(prefix.length);
         return /^\d$/.test(nextChar); 
       });
     });
 
     if (filteredKeys.length === 0) {
       alert("No suttas match your selected filters!");
       return;
     }
 
     const randomIndex = Math.floor(Math.random() * filteredKeys.length);
     const suttaId = filteredKeys[randomIndex];
     window.loadSutta(suttaId, shouldUpdateUrl);
  }


  // --- 3. SMART LOADER LOGIC (MỚI) ---

  const loadedFiles = new Set();
  
  // Helper: Tải 1 file script dạng Promise
  function loadScript(fileName) {
    return new Promise((resolve, reject) => {
      if (loadedFiles.has(fileName)) return resolve();

      const script = document.createElement("script");
      // Lưu ý đường dẫn: sutta_loader nằm ở assets/sutta/, file data ở assets/sutta/books/
      // Nhưng app.js ở assets/, nên path từ root là:
      script.src = `assets/sutta/books/${fileName}`;
      script.async = true;

      script.onload = () => {
        loadedFiles.add(fileName);
        console.log(`📦 Loaded: ${fileName}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`❌ Failed to load: ${fileName}`);
        // Không reject để Promise.all vẫn chạy tiếp các file khác
        resolve(); 
      };
      document.head.appendChild(script);
    });
  }

  // Helper: Tải 1 book cụ thể (ví dụ "mn" -> load "mn.js")
  function loadBookFile(bookId) {
    // Tìm file trong manifest
    const fileName = window.ALL_SUTTA_FILES.find(f => f === `${bookId}.js` || f.endsWith(`/${bookId}.js`));
    if (fileName) return loadScript(fileName);
    return Promise.resolve();
  }

  async function performSmartLoading() {
    statusDiv.textContent = "Loading core library...";
    
    // A. Phân tích URL để biết cần gì GẤP
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("q"); // vd: mn1
    const bookParam = params.get("b"); // vd: dn,mn
    
    let criticalFiles = new Set();

    // 1. Nếu có ?q=mn1 -> Cần file mn.js NGAY LẬP TỨC
    if (queryId) {
        const bookId = queryId.match(/^[a-z]+/)[0]; // mn1 -> mn
        // Tìm file JS tương ứng trong danh sách
        const file = window.ALL_SUTTA_FILES.find(f => f.includes(`/${bookId}.js`) || f === `${bookId}.js`);
        if (file) criticalFiles.add(file);
    }

    // 2. Nếu có ?b=dn,mn -> Cần các file này để Random pool đúng
    if (bookParam) {
        const books = bookParam.split(",");
        books.forEach(b => {
            const file = window.ALL_SUTTA_FILES.find(f => f.includes(`/${b.trim()}.js`) || f === `${b.trim()}.js`);
            if (file) criticalFiles.add(file);
        });
    }

    // 3. Nếu không có yêu cầu đặc biệt -> Load PRIMARY_BOOKS (DN, MN, SN, AN...)
    if (criticalFiles.size === 0) {
        window.PRIMARY_BOOKS.forEach(b => {
            const file = window.ALL_SUTTA_FILES.find(f => f.includes(`/${b}.js`) || f === `${b}.js`);
            if (file) criticalFiles.add(file);
        });
    }

    // --- PHASE 1: LOAD CRITICAL FILES ---
    await Promise.all(Array.from(criticalFiles).map(loadScript));

    // --- APP READY STATE ---
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden"); // Hiện thanh điều hướng nếu cần
    randomBtn.disabled = false;
    
    window.initFilters();
    if (window.setupQuickNav) window.setupQuickNav();

    // Render nội dung ngay sau khi phase 1 xong
    if (queryId) {
        window.renderSutta(queryId, true);
    } else {
        // Nếu đang ở random mode
        const isRandomLoop = params.get("r");
        if (isRandomLoop) {
             loadRandomSutta(false);
        } else {
            // Mới vào trang chủ -> Load 1 bài random
             loadRandomSutta(false);
             const bParam = window.generateBookParam();
             window.updateURL(null, bParam, true);
        }
    }

    // --- PHASE 2: LAZY LOAD THE REST (BACKGROUND) ---
    // Đợi 2 giây cho trình duyệt rảnh tay ("Idle")
    setTimeout(async () => {
        console.log("⏳ Starting background loading of remaining books...");
        
        // Lấy danh sách còn lại
        const remainingFiles = window.ALL_SUTTA_FILES.filter(f => !loadedFiles.has(f));
        
        // Tải tuần tự hoặc từng nhóm nhỏ để không đơ UI
        for (const file of remainingFiles) {
            await loadScript(file);
            // Delay nhẹ 50ms giữa các file để UI mượt
            await new Promise(r => setTimeout(r, 50));
        }
        
        console.log("✅ All books loaded in background.");
        
        // Cập nhật lại UI filters (nút Others/More Filters có thể hiện thêm sách mới tải xong)
        // window.initFilters(); // Optional: nếu muốn refresh lại list filter
    }, 2000); 
  }

  // Event Listeners (Giữ nguyên)
  randomBtn.addEventListener("click", () => loadRandomSutta(true));
  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      window.renderSutta(event.state.suttaId);
    }
  });

  // Bắt đầu quy trình
  if (window.ALL_SUTTA_FILES) {
      performSmartLoading();
  } else {
      console.error("Manifest not found!");
      statusDiv.textContent = "Error: Data manifest missing.";
  }
});