// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";

let tohInstance = null;

function getDisplayInfo(uid, metaMap) {
    // Fallback mặc định
    let mainTitle = uid.toUpperCase();
    let subTitle = "";

    if (metaMap && metaMap[uid]) {
        const info = metaMap[uid];
        // Ưu tiên Acronym (có dấu cách, VD: "AN 5.112")
        if (info.acronym) mainTitle = info.acronym;
        
        // Subtitle ưu tiên bản dịch -> bản gốc
        subTitle = info.translated_title || info.original_title || "";
    }
    
    return { main: mainTitle, sub: subTitle };
}

function updateTopNavDOM(data, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  // Hiển thị thông tin bài hiện tại
  const currentInfo = getDisplayInfo(data.uid, data.meta);
  if (navMainTitle) navMainTitle.textContent = currentInfo.main;
  if (navSubTitle) navSubTitle.textContent = currentInfo.sub;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  // Setup Nút Previous / Next
  const setupBtn = (btnId, targetId, type) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (targetId) {
      btn.disabled = false;
      btn.onclick = () => window.loadSutta(targetId);
      
      // Tra cứu info của bài hàng xóm
      const neighborInfo = getDisplayInfo(targetId, data.meta);
      
      // Tooltip hiển thị: "Next: AN 5.113 - Title"
      let tooltip = `${type}: ${neighborInfo.main}`;
      if (neighborInfo.sub) tooltip += ` - ${neighborInfo.sub}`;
      btn.title = tooltip;
      
    } else {
      btn.disabled = true;
      btn.onclick = null;
      btn.title = "";
    }
  };

  setupBtn("nav-prev", prevId, "Previous");
  setupBtn("nav-next", nextId, "Next");

  navHeader.classList.remove("hidden");
  statusDiv.classList.add("hidden");
}

function handleNotFound(suttaId) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  container.innerHTML = UIFactory.createErrorHtml(suttaId);
  statusDiv.textContent = "Sutta not found.";
  statusDiv.classList.remove("hidden");
}

export function renderSutta(suttaId, data, options = {}) {
  const container = document.getElementById("sutta-container");
  
  if (!data || !data.content) {
    handleNotFound(suttaId);
    return false;
  }

  // 1. Compile HTML
  const htmlContent = ContentCompiler.compile(data.content, data.uid);
  if (!htmlContent) return false;

  // 2. Navigation Logic
  const nav = calculateNavigation(data.bookStructure, data.uid);
  
  // 3. Update UI
  updateTopNavDOM(data, nav.prev, nav.next);
  
  // Truyền toàn bộ meta map xuống UIFactory để nó render nút dưới cùng
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
  
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}