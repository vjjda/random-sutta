// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const randomBtn = document.getElementById("btn-random");

  // Elements for Comment Popup
  const commentPopup = document.getElementById("comment-popup");
  const commentContent = document.getElementById("comment-content");
  const closeCommentBtn = document.getElementById("close-comment");

  // --- Comment Logic ---

  function showComment(text) {
    commentContent.innerHTML = text; // Hỗ trợ HTML trong comment nếu có
    commentPopup.classList.remove("hidden");
  }

  function hideComment() {
    commentPopup.classList.add("hidden");
  }

  // Event Delegation: Lắng nghe click trên toàn bộ container bài kinh
  container.addEventListener("click", (event) => {
    // Kiểm tra xem cái được click có phải là .comment-marker không
    if (event.target.classList.contains("comment-marker")) {
      const text = event.target.dataset.comment;
      if (text) {
        showComment(text);
        // Ngăn chặn sự kiện lan truyền (optional)
        event.stopPropagation();
      }
    } else {
      // Nếu click ra ngoài marker (vào text bài kinh), ẩn popup
      hideComment();
    }
  });

  // Close button logic
  closeCommentBtn.addEventListener("click", (e) => {
    hideComment();
    e.stopPropagation();
  });

  // Close when clicking escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideComment();
  });

  // --- Core Functions ---

  // 1. Render Sutta to View
  function renderSutta(suttaId) {
    const id = suttaId.toLowerCase().trim();

    if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
      container.innerHTML = `<p class="placeholder" style="color:red">⚠️ Sutta ID "<b>${id}</b>" not found.</p>`;
      statusDiv.textContent = "Error: Sutta not found.";
      return false;
    }

    const data = window.SUTTA_DB[id];

    // Build Navigation HTML
    let navHtml = '<div class="sutta-nav">';
    if (data.previous) {
      navHtml += `<button onclick="window.loadSutta('${
        data.previous
      }')">← ${data.previous.toUpperCase()}</button>`;
    } else {
      navHtml += `<span></span>`;
    }

    if (data.next) {
      navHtml += `<button onclick="window.loadSutta('${
        data.next
      }')">${data.next.toUpperCase()} →</button>`;
    }
    navHtml += "</div>";

    // Render Content
    container.innerHTML = navHtml + data.content + navHtml;
    statusDiv.textContent = `Displaying: ${id.toUpperCase()}`;

    // --- SCROLL LOGIC FIX ---
    // Kiểm tra xem URL hiện tại có hash (ví dụ #9.1) không
    const hash = window.location.hash;

    if (hash) {
      // Bỏ dấu # để lấy ID (ví dụ "9.1")
      const targetId = hash.substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        // Nếu tìm thấy element, cuộn tới nó
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

        // (Tùy chọn) Flash highlight lại để người dùng chú ý
        // CSS :target đã lo việc highlight, nhưng scrollIntoView đảm bảo nó nằm trong vùng nhìn thấy
      } else {
        // Có hash nhưng không tìm thấy element (VD: hash sai), cuộn lên đầu
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      // Không có hash, cuộn lên đầu như bình thường
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return true;
  }

  function updateURL(suttaId) {
    try {
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set("q", suttaId);
      window.history.pushState({ suttaId: suttaId }, "", currentUrl);
    } catch (e) {
      console.warn("Could not update URL:", e);
    }
  }

  // Nhớ update hàm loadSutta (nếu bạn đã tách nó ra global) để nó cũng gọi hideComment()
  window.loadSutta = function (suttaId) {
    hideComment(); // Reset popup
    if (renderSutta(suttaId)) {
      updateURL(suttaId);
    }
  };

  // CHỈ CẦN SỬA ĐOẠN NÀY ĐỂ KẾT NỐI VỚI NÚT RANDOM:
  function loadRandomSutta() {
    hideComment(); // Ẩn comment cũ nếu đang mở

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
      statusDiv.textContent = `Library loaded: ~${count} suttas available.`;
      statusDiv.style.color = "#666";
      randomBtn.disabled = false;

      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("q");
      if (queryId) {
        renderSutta(queryId);
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
