// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";

let tohInstance = null;

function getDisplayInfo(uid, metaMap) {
    // Fallback thông minh
    let main = uid.toUpperCase();
    
    // Thử tách số: an1.1 -> AN 1.1
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaMap && metaMap[uid]) {
        const info = metaMap[uid];
        return { 
            main: info.acronym || main, 
            sub: info.translated_title || info.original_title || "" 
        };
    }
    return { main: main, sub: "" };
}

// ... (Giữ nguyên updateTopNavDOM và handleNotFound) ...
function updateTopNavDOM(data, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  const currentInfo = getDisplayInfo(data.uid, data.meta);
  if (navMainTitle) navMainTitle.textContent = currentInfo.main;
  if (navSubTitle) navSubTitle.textContent = currentInfo.sub;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  const setupBtn = (btnId, targetId, type) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (targetId) {
      btn.disabled = false;
      btn.onclick = () => window.loadSutta(targetId);
      const neighborInfo = getDisplayInfo(targetId, data.meta);
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
  
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  // Clear container
  container.innerHTML = "";

  let htmlContent = "";

  // CASE 1: BRANCH VIEW (Mục lục)
  if (data.isBranch) {
      // Compile danh sách
      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      
      // Ẩn TOH
      document.getElementById("toh-wrapper")?.classList.add("hidden");
      
      // Với Branch, Nav Prev/Next thường không cần thiết hoặc phức tạp
      // Tạm thời ẩn Bottom Nav khi xem Branch
      // Hoặc ta có thể implement logic "Next Chapter" sau này
      updateTopNavDOM(data, null, null); 
      container.innerHTML = htmlContent;
      return true;
  }

  // CASE 2: LEAF VIEW (Bài kinh)
  if (!data.content) {
      handleNotFound(suttaId);
      return false;
  }

  htmlContent = ContentCompiler.compile(data.content, data.uid);
  const nav = calculateNavigation(data.bookStructure, data.uid);
  
  updateTopNavDOM(data, nav.prev, nav.next);
  
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}