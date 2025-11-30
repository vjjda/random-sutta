// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  
  // Filter Elements
  const primaryFiltersDiv = document.getElementById("primary-filters");
  const secondaryFiltersDiv = document.getElementById("secondary-filters");
  const moreFiltersBtn = document.getElementById("btn-more-filters");

  // --- CONFIGURATION ---
  
  // Danh sách các sách chính (hiển thị mặc định) - Khớp với hình bạn gửi
  const PRIMARY_BOOKS = ['dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig'];
  
  // Danh sách các sách phụ (ẩn trong More) - Dựa trên file loader.js
  const SECONDARY_BOOKS = [
      'bv', 'cnd', 'cp', 'ja', 'mil', 'mnd', 'ne', 'pe', 'ps', 'pv', 'tha-ap', 'thi-ap', 'vv'
  ];

  // State lưu trữ các sách đang được chọn
  // Mặc định chọn hết Primary
  const activeFilters = new Set(PRIMARY_BOOKS);

  // --- Filter Logic ---

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
      // Update UI status text (optional)
      // console.log("Active filters:", Array.from(activeFilters));
  }

  function createFilterButton(bookId, container, isDefaultActive) {
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      // Capitalize first letter (dn -> Dn), or special casing
      btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
      
      if (isDefaultActive) {
          btn.classList.add("active");
      }

      btn.addEventListener("click", () => toggleFilter(bookId, btn));
      container.appendChild(btn);
  }

  function initFilters() {
      // 1. Render Primary
      PRIMARY_BOOKS.forEach(book => createFilterButton(book, primaryFiltersDiv, true));

      // 2. Render Secondary
      SECONDARY_BOOKS.forEach(book => createFilterButton(book, secondaryFiltersDiv, false));

      // 3. Handle "More" toggle
      moreFiltersBtn.addEventListener("click", () => {
          secondaryFiltersDiv.classList.toggle("hidden");
          moreFiltersBtn.textContent = secondaryFiltersDiv.classList.contains("hidden") 
              ? "Show More Books..." 
              : "Hide More Books";
      });
  }

  // --- Comment Logic (Giữ nguyên) ---
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

  // --- Helper: Get Sutta Metadata ---
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

  // --- Core Functions ---

  function renderSutta(suttaId, checkHash = true) {
    const id = suttaId.toLowerCase().trim();
    if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
      container.innerHTML = `<p class="placeholder" style="color:red">⚠️ Sutta ID "<b>${id}</b>" not found.</p>`;
      statusDiv.textContent = "Error: Sutta not found.";
      return false;
    }

    const data = window.SUTTA_DB[id];
    const currentInfo = getSuttaDisplayInfo(id);
    
    // Build Navigation HTML
    let navHtml = '<div class="sutta-nav">';
    
    if (data.previous) {
      const prevInfo = getSuttaDisplayInfo(data.previous);
      const prevLabel = `← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span>`;     
      navHtml += `<button onclick="window.loadSutta('${data.previous}')" class="nav-btn">${prevLabel}</button>`;
    } else {
      navHtml += `<span></span>`;
    }

    if (data.next) {
      const nextInfo = getSuttaDisplayInfo(data.next);
      const nextLabel = `${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span>`;
      navHtml += `<button onclick="window.loadSutta('${data.next}')" class="nav-btn">${nextLabel}</button>`;
    }
    navHtml += "</div>";

    let contentHtml = data.content;
    container.innerHTML = navHtml + contentHtml + navHtml;
    
    statusDiv.textContent = currentInfo.subtitle 
        ? `${currentInfo.title}: ${currentInfo.subtitle}` 
        : `Displaying: ${currentInfo.title}`;

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
    if (renderSutta(suttaId, false)) {
      updateURL(suttaId);
    }
  };

  // UPDATED: Random Logic with Filter
  function loadRandomSutta() {
    hideComment();
    if (!window.SUTTA_DB) return;
    
    const allKeys = Object.keys(window.SUTTA_DB);
    if (allKeys.length === 0) return;

    // 1. Tạo danh sách các prefix đang active
    const activePrefixes = Array.from(activeFilters);

    // 2. Lọc danh sách keys dựa trên prefix
    // Ví dụ: activeFilters = ['mn', 'dhp'] -> giữ lại 'mn1', 'mn2', 'dhp1'...
    const filteredKeys = allKeys.filter(key => {
        // Kiểm tra xem key có bắt đầu bằng bất kỳ prefix nào đang active không
        // Lưu ý: ID thường là 'mn1', prefix là 'mn'. 
        // Cần cẩn thận với trường hợp prefix trùng nhau như 's' và 'sn' (nhưng ở đây prefixes khá rõ ràng)
        // Cách tốt nhất là dùng regex hoặc startsWith
        return activePrefixes.some(prefix => key.startsWith(prefix));
    });

    if (filteredKeys.length === 0) {
        alert("No suttas match your selected filters!");
        return;
    }

    // 3. Random từ danh sách đã lọc
    const randomIndex = Math.floor(Math.random() * filteredKeys.length);
    const suttaId = filteredKeys[randomIndex];

    console.log(`🎲 Random pool size: ${filteredKeys.length} (Total: ${allKeys.length})`);
    window.loadSutta(suttaId);
  }

  // --- Initialization ---

  function waitForData() {
    if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
      const count = Object.keys(window.SUTTA_DB).length;
      const nameCount = window.SUTTA_NAMES ? Object.keys(window.SUTTA_NAMES).length : 0;
      statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
      statusDiv.style.color = "#666";
      randomBtn.disabled = false;
      
      // Khởi tạo bộ lọc sau khi data đã sẵn sàng (hoặc init ngay cũng được, nhưng ở đây an toàn hơn)
      initFilters();

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