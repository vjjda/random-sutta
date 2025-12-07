// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
// [DELETED] import { calculateNavigation } from "./navigator.js"; 
// [DELETED] import { DB } from "../data/db_manager.js"; 

let tohInstance = null;

// ... (Giữ nguyên getDisplayInfo, updateTopNavDOM, handleNotFound) ...
function getDisplayInfo(uid, metaMap) {
    let main = uid.toUpperCase();
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

function updateTopNavDOM(data, prevId, nextId) {
    // ... (Giữ nguyên logic DOM manipulation bên trong, không thay đổi) ...
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

/**
 * [REFACTORED]
 * Renderer giờ chỉ nhận data và navData để hiển thị. 
 * Không còn gọi DB hay tính toán Nav.
 * @param {string} suttaId 
 * @param {object} data - Dữ liệu bài kinh (content, meta, structure)
 * @param {object} navData - Dữ liệu điều hướng { prev, next }
 * @param {object} options 
 */
export async function renderSutta(suttaId, data, navData, options = {}) {
  const container = document.getElementById("sutta-container");
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  container.innerHTML = "";
  let htmlContent = "";

  // [REMOVED] Logic calculateNavigation và Escalation đã chuyển sang NavigationService

  // Branch View
  if (data.isBranch) {
      // NOTE: Logic fetchMetaForUids (lazy load meta cho con) vẫn đang nằm ở đây hoặc cần chuyển ra Controller.
      // Để đảm bảo Renderer "sạch", dữ liệu 'data.meta' truyền vào NÊN ĐƯỢC chuẩn bị đủ từ bên ngoài.
      // Tuy nhiên, để tránh thay đổi quá lớn một lúc, tạm thời ta giả định 'data.meta' đã đủ
      // hoặc logic fetch con nằm ở Controller (sẽ cập nhật Controller sau).
      
      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      
      document.getElementById("toh-wrapper")?.classList.add("hidden");
      
      updateTopNavDOM(data, navData.prev, navData.next); 
      const bottomNavHtml = UIFactory.createBottomNavHtml(navData.prev, navData.next, data.meta);
      container.innerHTML = htmlContent + bottomNavHtml;
      
      return true;
  }

  // Leaf View
  if (!data.content) {
      handleNotFound(suttaId);
      return false;
  }

  htmlContent = ContentCompiler.compile(data.content, data.uid);
  
  updateTopNavDOM(data, navData.prev, navData.next);
  
  const bottomNavHtml = UIFactory.createBottomNavHtml(navData.prev, navData.next, data.meta);
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}