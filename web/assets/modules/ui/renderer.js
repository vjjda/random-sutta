// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";

let tohInstance = null;

/**
 * Helper: Xác định tiêu đề hiển thị
 */
function getDisplayInfo(uid, metaMap) {
    // Default nếu không có meta
    if (!metaMap || !metaMap[uid]) {
        return { 
            main: uid.toUpperCase(), 
            sub: "" 
        };
    }
    
    const info = metaMap[uid];
    
    // 1. Main Title: Ưu tiên Acronym, nếu không có thì dùng UID viết hoa
    let mainTitle = info.acronym || uid.toUpperCase();
    
    // 2. Sub Title: Ưu tiên Translated Title, fallback sang Original
    let subTitle = info.translated_title || info.original_title || "";

    return { main: mainTitle, sub: subTitle };
}

function updateTopNavDOM(data, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  // Lấy thông tin hiển thị từ meta
  const currentInfo = getDisplayInfo(data.uid, data.meta);
  
  if (navMainTitle) navMainTitle.textContent = currentInfo.main;
  if (navSubTitle) navSubTitle.textContent = currentInfo.sub;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  // Setup Buttons
  const setupBtn = (btn, targetId, type) => {
    if (targetId) {
      btn.disabled = false;
      btn.onclick = () => window.loadSutta(targetId);
      
      // Tooltip cho nút Previous/Next
      const neighborInfo = getDisplayInfo(targetId, data.meta);
      btn.title = `${type}: ${neighborInfo.main}`;
      if (neighborInfo.sub) btn.title += ` - ${neighborInfo.sub}`;
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
  
  // 3. Update Header
  updateTopNavDOM(data, nav.prev, nav.next);
  
  // 4. Update Bottom Nav
  // Truyền meta vào để UIFactory biết đường lấy tiêu đề cho nút bấm
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
  
  container.innerHTML = htmlContent + bottomNavHtml;

  // 5. Setup Table of Headings
  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}