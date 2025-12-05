// Path: web/assets/modules/renderer.js
import { DB } from "./db_manager.js";
import { getSuttaDisplayInfo } from "./utils.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { Scroller } from "./scroller.js";

let tohInstance = null;

function updateTopNavDOM(currentId, prevId, nextId) {
  // Logic cập nhật DOM cho Top Nav (Header)
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  const currentInfo = getSuttaDisplayInfo(currentId);
  if (navMainTitle) navMainTitle.textContent = currentInfo.title;
  if (navSubTitle) navSubTitle.textContent = currentInfo.subtitle;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  const setupBtn = (btn, id, type) => {
    if (id) {
      btn.disabled = false;
      btn.onclick = () => window.loadSutta(id);
      btn.title = `${type}: ${getSuttaDisplayInfo(id).title}`;
    } else {
      btn.disabled = true;
      btn.onclick = null;
      btn.title = "";
    }
  };

  setupBtn(navPrevBtn, prevId, "Previous");
  setupBtn(navNextBtn, nextId, "Next");

  navHeader.classList.remove("hidden");
  statusDiv.classList.add("hidden");
}

function handleNotFound(suttaId) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");

  container.innerHTML = UIFactory.createErrorHtml(suttaId);

  statusDiv.textContent = "Sutta not found.";
  statusDiv.classList.remove("hidden");
  navHeader.classList.remove("hidden");

  const mTitle = document.getElementById("nav-main-title");
  const sTitle = document.getElementById("nav-sub-title");
  if (mTitle) mTitle.textContent = "Not Found";
  if (sTitle) sTitle.textContent = "---";
}

export function renderSutta(suttaId, options = {}) {
  const checkHash = options.checkHash !== false;
  const explicitId = options.highlightId;
  const noHighlight = options.noHighlight === true;
  const restoreScrollY = options.restoreScroll || 0;
  const noScroll = options.noScroll === true;

  const id = suttaId.toLowerCase().trim();
  const container = document.getElementById("sutta-container");
  const book = DB.findBookContaining(id);

  if (!book) {
    handleNotFound(id);
    return false;
  }

  // ... (Logic compile HTML giữ nguyên) ...
  let htmlContent = DB.compileHtml(id);
  let isBranch = false;
  if (!htmlContent) {
    htmlContent = DB.compileBranchHtml(id);
    isBranch = true;
  }
  if (!htmlContent) return false;

  const nav = DB.getNavigation(id);
  // (Giả sử hàm updateTopNavDOM đã import và có sẵn)
  // updateTopNavDOM(id, nav.prev, nav.next);
  // Code thực tế của bạn có updateTopNavDOM ở trên, cứ giữ nguyên.

  // [FIX] Cần import hoặc define updateTopNavDOM nếu file này chưa export nó
  // Giả định code cũ của bạn đã có updateTopNavDOM trong scope này.

  // Render HTML
  // (Giữ nguyên logic render UI)
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next); // Cần đảm bảo UIFactory đã import
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings(); // Cần đảm bảo biến tohInstance
  if (isBranch) {
    document.getElementById("toh-wrapper")?.classList.add("hidden");
  } else {
    tohInstance.generate();
  }

  // --- Logic Scroll & Highlight ---

  // Nếu bị cấm cuộn (thường dùng khi pre-load hoặc back/forward history đặc biệt)
  if (noScroll) return true;

  // Xác định Target ID
  let targetId = null;
  if (explicitId) {
    targetId = explicitId.replace("#", "");
  } else if (checkHash && window.location.hash) {
    targetId = window.location.hash.substring(1);
  } else {
    const meta = DB.getMeta(id); // id lấy từ closure bên trên
    if (meta && meta.scroll_target) {
      targetId = meta.scroll_target;
    }
  }

  if (targetId) {
    // [UPDATED] Gọi Scroller thống nhất
    // Sử dụng setTimeout 0 để đảm bảo DOM đã paint xong trước khi tính toán tọa độ
    setTimeout(() => Scroller.scrollToId(targetId), 0);
  } else {
    // Logic restore scroll hoặc về đầu trang
    if (restoreScrollY > 0) {
      window.scrollTo(0, restoreScrollY);
    } else {
      window.scrollTo(0, 0);
    }
  }

  return true;
}
