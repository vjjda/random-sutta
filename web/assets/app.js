// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", async () => {
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  const navHeader = document.getElementById("nav-header");

  // --- 1. SETUP UI HANDLERS ---
  const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
  const filterDrawer = document.getElementById("filter-drawer");

  if (toggleDrawerBtn && filterDrawer) {
    toggleDrawerBtn.addEventListener("click", () => {
      filterDrawer.classList.toggle("hidden");
      toggleDrawerBtn.classList.toggle("open");
    });
  }
  // ---------------------------

  const { hideComment } = window.initCommentPopup();

  // --- 2. CORE FUNCTIONS ---

  window.loadSutta = function (suttaId, shouldUpdateUrl = true) {
    hideComment();
    // Thử render ngay
    if (window.renderSutta(suttaId, false)) {
      if (shouldUpdateUrl) {
        const bookParam = window.generateBookParam();
        window.updateURL(suttaId, bookParam);
      }
    } else {
      // FALLBACK: Nếu chưa có data, thử tải file book tương ứng
      const requiredBook = suttaId.match(/^[a-z]+/)[0]; // mn1 -> mn
      console.log(`⚠️ Data for ${suttaId} missing. Fetching ${requiredBook}...`);
      
      loadBookFile(requiredBook).then(() => {
        if (window.renderSutta(suttaId, false)) {
          if (shouldUpdateUrl) {
            const bookParam = window.generateBookParam();
            window.updateURL(suttaId, bookParam);
          }
        } else {
             alert("Sutta not found even after loading data.");
        }
      });
    }
  };

  function loadRandomSutta(shouldUpdateUrl = true) {
    hideComment();
    if (!window.SUTTA_DB) return;

    const allKeys = Object.keys(window.SUTTA_DB);
    if (allKeys.length === 0) return;

    const activePrefixes = window.getActiveFilters();
    // Filter keys based on selected books
    const filteredKeys = allKeys.filter((key) => {
      return activePrefixes.some((prefix) => {
        if (!key.startsWith(prefix)) return false;
        const nextChar = key.charAt(prefix.length);
        return /^\d$/.test(nextChar); // e.g. dn[1]...
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

  // --- 3. SMART LOADER LOGIC ---

  const loadedFiles = new Set();
  
  // Helper: Tải 1 file script dạng Promise
  function loadScript(fileName) {
    return new Promise((resolve, reject) => {
      if (loadedFiles.has(fileName)) return resolve();

      const script = document.createElement("script");
      // App chạy từ index.html nên đường dẫn tính từ root
      script.src = `assets/sutta/books/${fileName}`;
      script.async = true;

      script.onload = () => {
        loadedFiles.add(fileName);
        console.log(`📦 Loaded: ${fileName}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`❌ Failed to load: ${fileName}`);
        // Resolve luôn để không chặn Promise.all
        resolve(); 
      };
      document.head.appendChild(script);
    });
  }

  // Helper: Tải 1 book cụ thể
  function loadBookFile(bookId) {
    if (!window.ALL_SUTTA_FILES) return Promise.resolve();
    
    // Tìm file match với bookId (ví dụ "mn" match "mn.js")
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
        const bookId = queryId.match(/^[a-z]+/)[0];
        const file = window.ALL_SUTTA_FILES.find(f => f.includes(`/${bookId}.js`) || f === `${bookId}.js`);
        if (file) criticalFiles.add(file);
    }

    // 2. Nếu có ?b=dn,mn -> Cần các file này
    if (bookParam) {
        const books = bookParam.split(",");
        books.forEach(b => {
            const file = window.ALL_SUTTA_FILES.find(f => f.includes(`/${b.trim()}.js`) || f === `${b.trim()}.js`);
            if (file) criticalFiles.add(file);
        });
    }

    // 3. Nếu không có yêu cầu đặc biệt -> Load PRIMARY_BOOKS mặc định
    if (criticalFiles.size === 0) {
        window.PRIMARY_BOOKS.forEach(b => {
            const file = window.ALL_SUTTA_FILES.find(f => f.includes(`/${b}.js`) || f === `${b}.js`);
            if (file) criticalFiles.add(file);
        });
    }

    // --- PHASE 1: LOAD CRITICAL FILES ---
    console.log("🚀 Loading critical files:", Array.from(criticalFiles));
    await Promise.all(Array.from(criticalFiles).map(loadScript));

    // --- APP READY STATE ---
    statusDiv.classList.add("hidden");
    navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    
    // Init logic filters
    window.initFilters();
    if (window.setupQuickNav) window.setupQuickNav();

    // Render nội dung ngay sau khi phase 1 xong
    if (queryId) {
        window.renderSutta(queryId, true);
    } else {
        const isRandomLoop = params.get("r");
        if (isRandomLoop) {
             loadRandomSutta(false);
        } else if (!queryId) {
             // Mặc định: Random 1 bài
             loadRandomSutta(false);
             const bParam = window.generateBookParam();
             window.updateURL(null, bParam, true);
        }
    }

    // --- PHASE 2: LAZY LOAD THE REST (BACKGROUND) ---
    setTimeout(async () => {
        console.log("⏳ Starting background loading...");
        
        const remainingFiles = window.ALL_SUTTA_FILES.filter(f => !loadedFiles.has(f));
        
        for (const file of remainingFiles) {
            await loadScript(file);
            // Delay nhẹ để tránh lag UI
            await new Promise(r => setTimeout(r, 50));
        }
        
        console.log("✅ All books loaded in background.");
        // Re-sync filters UI nếu cần
        // window.initFilters();
    }, 2000); 
  }

  // --- 4. Event Listeners ---
  randomBtn.addEventListener("click", () => loadRandomSutta(true));
  
  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      window.renderSutta(event.state.suttaId);
    } else {
        const p = new URLSearchParams(window.location.search);
        const q = p.get("q");
        if(q) window.loadSutta(q);
    }
  });

  // --- START ---
  if (window.ALL_SUTTA_FILES) {
      performSmartLoading();
  } else {
      console.error("Manifest (ALL_SUTTA_FILES) not found! Check sutta_loader.js");
      statusDiv.textContent = "Error: Data manifest missing.";
  }
});