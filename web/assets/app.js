// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");

  // --- NAV ELEMENTS (Top Header) ---
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");

  // --- FILTER ELEMENTS ---
  const primaryFiltersDiv = document.getElementById("primary-filters");
  const secondaryFiltersDiv = document.getElementById("secondary-filters");
  const moreFiltersBtn = document.getElementById("btn-more-filters");

  // --- CONFIGURATION ---
  // Danh sách sách chính (hiển thị mặc định)
  const PRIMARY_BOOKS = ['dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig'];
  
  // Danh sách sách phụ (ẩn trong Others)
  const SECONDARY_BOOKS = [
      'bv', 'cnd', 'cp', 'ja', 'mil', 'mnd', 'ne', 'pe', 'ps', 'pv', 'tha-ap', 'thi-ap', 'vv'
  ];

  // State: Lưu trữ các sách đang được chọn (mặc định chọn hết Primary)
  const activeFilters = new Set(PRIMARY_BOOKS);

  // --- FILTER LOGIC ---

  function toggleFilter(bookId, btnElement) {
      if (activeFilters.has(bookId)) {
          // Không cho phép bỏ chọn hết (ít nhất phải giữ 1 cái để random)
          if (activeFilters.size === 1) return;
          activeFilters.delete(bookId);
          btnElement.classList.remove("active");
      } else {
          activeFilters.add(bookId);
          btnElement.classList.add("active");
      }
  }

  function createFilterButton(bookId, container, isDefaultActive) {
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      // Viết hoa chữ cái đầu: dn -> Dn
      btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
      
      if (isDefaultActive) {
          btn.classList.add("active");
          // Đảm bảo state đồng bộ (dù activeFilters đã init ở trên nhưng cứ chắc chắn)
          activeFilters.add(bookId);
      }

      btn.addEventListener("click", () => toggleFilter(bookId, btn));
      container.appendChild(btn);
  }

  function initFilters() {
      // Xóa nội dung cũ nếu có để tránh duplicate khi reload
      primaryFiltersDiv.innerHTML = "";
      secondaryFiltersDiv.innerHTML = "";

      // 1. Render Primary
      PRIMARY_BOOKS.forEach(book => createFilterButton(book, primaryFiltersDiv, true));

      // 2. Render Secondary
      SECONDARY_BOOKS.forEach(book => createFilterButton(book, secondaryFiltersDiv, false));

      // 3. Handle "Others" toggle
      moreFiltersBtn.addEventListener("click", () => {
          secondaryFiltersDiv.classList.toggle("hidden");
          moreFiltersBtn.textContent = secondaryFiltersDiv.classList.contains("hidden") 
              ? "Others" 
              : "Hide";
      });
  }

  // --- COMMENT LOGIC ---
  const commentPopup = document.getElementById("comment-popup");
  const commentContent = document.getElementById("comment-content");
  const closeCommentBtn = document.getElementById("close-comment");

  function showComment(text) {
    commentContent.innerHTML = text; 
    commentPopup.classList.remove("hidden");
  }

  function hideComment() {
    commentPopup.classList.add("hidden");
  }

  container.addEventListener("click", (event) => {
    if (event.target.classList.contains("comment-marker")) {
      const text = event.target.dataset.comment;
      if (text) {
        showComment(text);
        event.stopPropagation();
      }
    } else {
      hideComment();
    }
  });

  closeCommentBtn.addEventListener("click", (e) => {
    hideComment();
    e.stopPropagation();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideComment();
  });

  // --- HELPER: GET METADATA ---
  function getSuttaDisplayInfo(id) {
    let info = {
        title: id.toUpperCase(), 
        subtitle: ""
    };
    if (window.SUTTA_NAMES && window.SUTTA_NAMES[id]) {
        const meta = window.SUTTA_NAMES[id];
        if (meta.acronym) info.title = meta.acronym;
        
        if (meta.translated_title) {
            info.subtitle = meta.translated_title;
        } else if (meta.original_title) {
            info.subtitle = meta.original_title;
        }
    }
    return info;
  }

  // --- CORE FUNCTIONS ---

  // 1. Update Top Navigation Header
  function updateTopNav(currentId, prevId, nextId) {
      const currentInfo = getSuttaDisplayInfo(currentId);
      
      // Update Center Title
      navMainTitle.textContent = currentInfo.title;
      navSubTitle.textContent = currentInfo.subtitle;

      // Update Previous Arrow
      if (prevId) {
          navPrevBtn.disabled = false;
          navPrevBtn.onclick = () => window.loadSutta(prevId);
          const prevInfo = getSuttaDisplayInfo(prevId);
          navPrevBtn.title = `Previous: ${prevInfo.title}`;
      } else {
          navPrevBtn.disabled = true;
          navPrevBtn.onclick = null;
          navPrevBtn.title = "";
      }

      // Update Next Arrow
      if (nextId) {
          navNextBtn.disabled = false;
          navNextBtn.onclick = () => window.loadSutta(nextId);
          const nextInfo = getSuttaDisplayInfo(nextId);
          navNextBtn.title = `Next: ${nextInfo.title}`;
      } else {
          navNextBtn.disabled = true;
          navNextBtn.onclick = null;
          navNextBtn.title = "";
      }

      // Show Nav, Hide Status
      navHeader.classList.remove("hidden");
      statusDiv.classList.add("hidden");
  }

  // 2. Render Sutta Content
  function renderSutta(suttaId, checkHash = true) {
    const id = suttaId.toLowerCase().trim();
    
    // Check DB
    if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
      container.innerHTML = `<p class="placeholder" style="color:red">Sutta ID "<b>${id}</b>" not found.</p>`;
      statusDiv.textContent = "Error: Sutta not found.";
      statusDiv.classList.remove("hidden");
      navHeader.classList.add("hidden");
      return false;
    }

    const data = window.SUTTA_DB[id];
    
    // A. Update Top Nav
    updateTopNav(id, data.previous, data.next);

    // B. Build Bottom Nav (Text links)
    let bottomNavHtml = '<div class="sutta-nav">';
    
    if (data.previous) {
      const prevInfo = getSuttaDisplayInfo(data.previous);
      const prevLabel = `← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span>`;     
      bottomNavHtml += `<button onclick="window.loadSutta('${data.previous}')" class="nav-btn">${prevLabel}</button>`;
    } else {
      bottomNavHtml += `<span></span>`;
    }

    if (data.next) {
      const nextInfo = getSuttaDisplayInfo(data.next);
      const nextLabel = `${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span>`;
      bottomNavHtml += `<button onclick="window.loadSutta('${data.next}')" class="nav-btn">${nextLabel}</button>`;
    }
    bottomNavHtml += "</div>";

    // C. Inject Content
    container.innerHTML = data.content + bottomNavHtml;
    
    // D. Scroll Logic
    const hash = window.location.hash;
    if (checkHash && hash) {
      const targetId = hash.substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        targetElement.classList.add("highlight");
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return true;
  }

  function updateURL(suttaId) {
    try {
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set("q", suttaId);
      currentUrl.hash = "";
      window.history.pushState({ suttaId: suttaId }, "", currentUrl);
    } catch (e) {
      console.warn("Could not update URL:", e);
    }
  }

  window.loadSutta = function (suttaId) {
    hideComment();
    // Khi load bài mới thì không checkHash (để scroll lên đầu)
    if (renderSutta(suttaId, false)) {
      updateURL(suttaId);
    }
  };

  // 3. Random Logic (With Filter)
  function loadRandomSutta() {
    hideComment();
    if (!window.SUTTA_DB) return;
    
    const allKeys = Object.keys(window.SUTTA_DB);
    if (allKeys.length === 0) return;

    // Lọc danh sách bài kinh dựa trên bộ lọc đang active
    const activePrefixes = Array.from(activeFilters);
    const filteredKeys = allKeys.filter(key => {
        // ID thường là 'mn1', 'dn2'... prefix là 'mn', 'dn'
        return activePrefixes.some(prefix => key.startsWith(prefix));
    });

    if (filteredKeys.length === 0) {
        alert("No suttas match your selected filters!");
        return;
    }

    const randomIndex = Math.floor(Math.random() * filteredKeys.length);
    const suttaId = filteredKeys[randomIndex];

    window.loadSutta(suttaId);
  }

  // --- INITIALIZATION ---
  function waitForData() {
    if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
      const count = Object.keys(window.SUTTA_DB).length;
      const nameCount = window.SUTTA_NAMES ? Object.keys(window.SUTTA_NAMES).length : 0;
      
      statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
      statusDiv.classList.remove("hidden");
      navHeader.classList.add("hidden"); // Mặc định ẩn nav khi chưa load bài
      randomBtn.disabled = false;
      
      // Khởi tạo bộ lọc
      initFilters();

      // Kiểm tra URL nếu có bài kinh được share
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      if (queryId) {
        renderSutta(queryId, true);
      }
    } else {
      statusDiv.textContent = "Loading database files...";
      setTimeout(waitForData, 100);
    }
  }

  randomBtn.addEventListener("click", loadRandomSutta);

  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.suttaId) {
      renderSutta(event.state.suttaId);
    } else {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      if (queryId) renderSutta(queryId);
    }
  });

  waitForData();
});