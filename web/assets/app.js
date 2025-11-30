// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");

  // Elements for Comment Popup
  const commentPopup = document.getElementById("comment-popup");
  const commentContent = document.getElementById("comment-content");
  const closeCommentBtn = document.getElementById("close-comment");

  // --- Helper: Get Sutta Metadata ---
  // Trả về object { title, subtitle } để hiển thị
  function getSuttaDisplayInfo(id) {
    // Default fallback
    let info = {
        title: id.toUpperCase(), // Dùng ID làm title chính nếu ko có dữ liệu
        subtitle: ""
    };

    if (window.SUTTA_NAMES && window.SUTTA_NAMES[id]) {
        const meta = window.SUTTA_NAMES[id];
        
        // 1. Acronym (ưu tiên hiển thị số hiệu chuẩn, ví dụ: MN 1)
        if (meta.acronym) {
            info.title = meta.acronym;
        }

        // 2. Title (ưu tiên bản dịch -> bản gốc)
        if (meta.translated_title) {
            info.subtitle = meta.translated_title;
        } else if (meta.original_title) {
            info.subtitle = meta.original_title;
        }
    }
    return info;
  }

  // --- Comment Logic ---
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
    
    // Previous Button
    if (data.previous) {
      const prevInfo = getSuttaDisplayInfo(data.previous);
      // Format: "MN 1" ở dòng trên, "Tên bài kinh" ở dòng dưới
      const prevLabel = `← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span>`;     
      navHtml += `<button onclick="window.loadSutta('${data.previous}')" class="nav-btn">${prevLabel}</button>`;
    } else {
      navHtml += `<span></span>`;
    }

    // Next Button
    if (data.next) {
      const nextInfo = getSuttaDisplayInfo(data.next);
      const nextLabel = `${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span>`;
      navHtml += `<button onclick="window.loadSutta('${data.next}')" class="nav-btn">${nextLabel}</button>`;
    }
    navHtml += "</div>";

    // Inject Title into Content (Optional)
    let contentHtml = data.content;
    
    // Render Content
    container.innerHTML = navHtml + contentHtml + navHtml;
    
    // Update Status with Title
    statusDiv.textContent = currentInfo.subtitle 
        ? `${currentInfo.title}: ${currentInfo.subtitle}` 
        : `Displaying: ${currentInfo.title}`;

    // --- SCROLL & HIGHLIGHT LOGIC ---
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

  function loadRandomSutta() {
    hideComment();
    if (!window.SUTTA_DB) return;
    const keys = Object.keys(window.SUTTA_DB);
    if (keys.length === 0) return;

    const randomIndex = Math.floor(Math.random() * keys.length);
    const suttaId = keys[randomIndex];

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