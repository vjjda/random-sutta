// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";

let tohInstance = null;

function getDisplayInfo(uid, metaMap) {
    // 1. Nếu có Meta (Cùng chunk hoặc là Branch) -> Hiển thị đẹp
    if (metaMap && metaMap[uid]) {
        const info = metaMap[uid];
        return { 
            main: info.acronym || uid.toUpperCase(), 
            sub: info.translated_title || info.original_title || "" 
        };
    }
    
    // 2. Fallback (Khác chunk) -> Hiển thị UID được format đẹp
    // Ví dụ: an1.10 -> AN 1.10 (Thử tách chữ và số để viết hoa)
    let formattedId = uid.toUpperCase();
    
    // Thử regex để tách: mn1 -> MN 1
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) {
        formattedId = `${match[1].toUpperCase()} ${match[2]}`;
    }

    return { main: formattedId, sub: "" };
}

function updateTopNavDOM(data, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  // Title chính (Luôn có vì đã load chunk hiện tại)
  const currentInfo = getDisplayInfo(data.uid, data.meta);
  if (navMainTitle) navMainTitle.textContent = currentInfo.main;
  if (navSubTitle) navSubTitle.textContent = currentInfo.sub;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  // Setup Buttons
  const setupBtn = (btnId, targetId, type) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (targetId) {
      btn.disabled = false;
      btn.onclick = () => window.loadSutta(targetId);
      
      const neighborInfo = getDisplayInfo(targetId, data.meta);
      
      // Nếu có sub (Title) thì hiện, không thì chỉ hiện Main (ID)
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

  const htmlContent = ContentCompiler.compile(data.content, data.uid);
  if (!htmlContent) return false;

  const nav = calculateNavigation(data.bookStructure, data.uid);
  
  updateTopNavDOM(data, nav.prev, nav.next);
  
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
  
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}