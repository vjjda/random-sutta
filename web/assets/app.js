// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");
  
  // New Nav Elements
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");

  // Filter Elements & Logic (Giữ nguyên)
  // ... (Code filter giữ nguyên không đổi) ...
  const primaryFiltersDiv = document.getElementById("primary-filters");
  const secondaryFiltersDiv = document.getElementById("secondary-filters");
  const moreFiltersBtn = document.getElementById("btn-more-filters");
  const PRIMARY_BOOKS = ['dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig'];
  const SECONDARY_BOOKS = ['bv', 'cnd', 'cp', 'ja', 'mil', 'mnd', 'ne', 'pe', 'ps', 'pv', 'tha-ap', 'thi-ap', 'vv'];
  const activeFilters = new Set(PRIMARY_BOOKS);

  function toggleFilter(bookId, btnElement) { /* ... Giữ nguyên ... */ 
      if (activeFilters.has(bookId)) {
          if (activeFilters.size === 1) return;
          activeFilters.delete(bookId);
          btnElement.classList.remove("active");
      } else {
          activeFilters.add(bookId);
          btnElement.classList.add("active");
      }
  }
  function createFilterButton(bookId, container, isDefaultActive) { /* ... Giữ nguyên ... */ 
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.textContent = bookId.charAt(0).toUpperCase() + bookId.slice(1);
      if (isDefaultActive) btn.classList.add("active");
      btn.addEventListener("click", () => toggleFilter(bookId, btn));
      container.appendChild(btn);
  }
  function initFilters() { /* ... Giữ nguyên ... */ 
      PRIMARY_BOOKS.forEach(book => createFilterButton(book, primaryFiltersDiv, true));
      SECONDARY_BOOKS.forEach(book => createFilterButton(book, secondaryFiltersDiv, false));
      moreFiltersBtn.addEventListener("click", () => {
          secondaryFiltersDiv.classList.toggle("hidden");
          moreFiltersBtn.textContent = secondaryFiltersDiv.classList.contains("hidden") ? "Others" : "Hide";
      });
  }

  // --- Comment Logic (Giữ nguyên) ---
  const commentPopup = document.getElementById("comment-popup");
  const commentContent = document.getElementById("comment-content");
  const closeCommentBtn = document.getElementById("close-comment");
  function showComment(text) { commentContent.innerHTML = text; commentPopup.classList.remove("hidden"); }
  function hideComment() { commentPopup.classList.add("hidden"); }
  container.addEventListener("click", (event) => { if (event.target.classList.contains("comment-marker")) { const text = event.target.dataset.comment; if (text) { showComment(text); event.stopPropagation(); } } else { hideComment(); } });
  closeCommentBtn.addEventListener("click", (e) => { hideComment(); e.stopPropagation(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideComment(); });

  // --- Helper: Get Sutta Metadata ---
  function getSuttaDisplayInfo(id) {
    let info = { title: id.toUpperCase(), subtitle: "" };
    if (window.SUTTA_NAMES && window.SUTTA_NAMES[id]) {
        const meta = window.SUTTA_NAMES[id];
        if (meta.acronym) info.title = meta.acronym;
        if (meta.translated_title) info.subtitle = meta.translated_title;
        else if (meta.original_title) info.subtitle = meta.original_title;
    }
    return info;
  }

  // --- Core Functions ---

  // UPDATED: Function to update the top Nav Bar
  function updateTopNav(currentId, prevId, nextId) {
      const currentInfo = getSuttaDisplayInfo(currentId);
      
      // Update Center Title
      navMainTitle.textContent = currentInfo.title;
      navSubTitle.textContent = currentInfo.subtitle;

      // Update Arrows
      if (prevId) {
          navPrevBtn.disabled = false;
          navPrevBtn.onclick = () => window.loadSutta(prevId);
          // Optional: Add tooltip with title
          const prevInfo = getSuttaDisplayInfo(prevId);
          navPrevBtn.title = `Previous: ${prevInfo.title}`;
      } else {
          navPrevBtn.disabled = true;
          navPrevBtn.onclick = null;
      }

      if (nextId) {
          navNextBtn.disabled = false;
          navNextBtn.onclick = () => window.loadSutta(nextId);
          const nextInfo = getSuttaDisplayInfo(nextId);
          navNextBtn.title = `Next: ${nextInfo.title}`;
      } else {
          navNextBtn.disabled = true;
          navNextBtn.onclick = null;
      }

      // Show Nav, Hide Status
      navHeader.classList.remove("hidden");
      statusDiv.classList.add("hidden");
  }

  function renderSutta(suttaId, checkHash = true) {
    const id = suttaId.toLowerCase().trim();
    if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
      container.innerHTML = `<p class="placeholder" style="color:red">Sutta ID "<b>${id}</b>" not found.</p>`;
      // Show error in status, hide nav
      statusDiv.textContent = "Error: Sutta not found.";
      statusDiv.classList.remove("hidden");
      navHeader.classList.add("hidden");
      return false;
    }

    const data = window.SUTTA_DB[id];
    
    // 1. UPDATE TOP NAV
    updateTopNav(id, data.previous, data.next);

    // 2. BUILD CONTENT (Only Bottom Nav)
    // Removed Top Nav generation here
    
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

    // 3. RENDER
    container.innerHTML = data.content + bottomNavHtml;
    
    // --- SCROLL LOGIC ---
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

  function loadRandomSutta() { /* ... Giữ nguyên ... */
    hideComment();
    if (!window.SUTTA_DB) return;
    const allKeys = Object.keys(window.SUTTA_DB);
    if (allKeys.length === 0) return;
    const activePrefixes = Array.from(activeFilters);
    const filteredKeys = allKeys.filter(key => {
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

  // --- Initialization ---
  function waitForData() {
    if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
      const count = Object.keys(window.SUTTA_DB).length;
      const nameCount = window.SUTTA_NAMES ? Object.keys(window.SUTTA_NAMES).length : 0;
      
      statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
      statusDiv.classList.remove("hidden"); // Show init status
      navHeader.classList.add("hidden");    // Hide nav initially
      randomBtn.disabled = false;
      
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