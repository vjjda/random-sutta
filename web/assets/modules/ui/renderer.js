// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";

let tohInstance = null;

// ... (getDisplayInfo giữ nguyên) ...
function getDisplayInfo(uid, metaMap) {
    if (metaMap && metaMap[uid]) {
        const info = metaMap[uid];
        return { 
            main: info.acronym || uid.toUpperCase(), 
            sub: info.translated_title || info.original_title || "" 
        };
    }
    return { main: uid.toUpperCase(), sub: "" };
}

// ... (updateTopNavDOM giữ nguyên) ...
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
    // ... (Giữ nguyên) ...
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

  let htmlContent = "";

  // [NEW] Logic phân nhánh: Branch vs Leaf
  if (data.isBranch) {
      // Render Mục lục
      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      
      // Ẩn Table of Headings khi ở chế độ Branch View
      document.getElementById("toh-wrapper")?.classList.add("hidden");
  } else {
      // Render Bài kinh (Leaf)
      if (!data.content) { handleNotFound(suttaId); return false; }
      htmlContent = ContentCompiler.compile(data.content, data.uid);
  }

  if (!htmlContent) return false;

  // Navigation Logic
  const nav = calculateNavigation(data.bookStructure, data.uid);
  
  updateTopNavDOM(data, nav.prev, nav.next);
  
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
  container.innerHTML = htmlContent + bottomNavHtml;

  // Chỉ setup TOH nếu là Leaf
  if (!data.isBranch) {
      if (!tohInstance) tohInstance = setupTableOfHeadings();
      tohInstance.generate();
  }

  return true;
}