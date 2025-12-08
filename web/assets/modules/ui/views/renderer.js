// Path: web/assets/modules/ui/views/renderer.js
import { ContentCompiler } from "../../data/content_compiler.js"; 
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";

let tohInstance = null;

function getDisplayInfo(uid, metaEntry) {
    let main = uid.toUpperCase();
    let sub = "";

    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaEntry) {
        main = metaEntry.acronym || main;
        sub = metaEntry.translated_title || metaEntry.original_title || "";
    }

    return { main, sub };
}

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
            
            const neighborMeta = data.navMeta ? data.navMeta[targetId] : null;
            const neighborInfo = getDisplayInfo(targetId, neighborMeta);
            
            let tooltip = `${type}: ${neighborInfo.main}`;
            if (neighborInfo.sub) tooltip += ` - ${neighborInfo.sub}`;
            btn.title = tooltip;
        } else {
            btn.disabled = true;
            btn.onclick = null;
            btn.title = ""; // Xóa tooltip cũ
        }
    };

    setupBtn("nav-prev", prevId, "Previous");
    setupBtn("nav-next", nextId, "Next");

    if (navHeader) navHeader.classList.remove("hidden");
    if (statusDiv) statusDiv.classList.add("hidden");
}

function handleNotFound(suttaId) {
    const container = document.getElementById("sutta-container");
    const statusDiv = document.getElementById("status");
    if (container) container.innerHTML = UIFactory.createErrorHtml(suttaId);
    if (statusDiv) {
        statusDiv.textContent = "Sutta not found.";
        statusDiv.classList.remove("hidden");
    }
}

export async function renderSutta(suttaId, data, options = {}) {
  const container = document.getElementById("sutta-container");
  
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  container.innerHTML = "";
  let htmlContent = "";
  
  const nav = data.nav || {}; 
  const prevId = nav.prev || null;
  const nextId = nav.next || null;

  // Xác định loại View
  const type = data.meta ? data.meta.type : null;
  
  // Danh sách các type được coi là Branch/Menu
  const branchTypes = ['root', 'super_book', 'sub_book', 'book', 'branch'];
  
  // Logic: Là Branch nếu type thuộc list trên HOẶC (có structure và không có content)
  const isBranchView = branchTypes.includes(type) || (data.bookStructure && !data.content);

  // --- CASE 1: BRANCH / MENU ---
  if (isBranchView) {
      // Dùng contextMeta để render danh sách con
      // [FIX] Nếu data.contextMeta bị thiếu, fallback về data.meta (dù có thể thiếu info con)
      const metaForMenu = data.contextMeta || {};
      
      // Inject chính meta của node hiện tại vào map để render header nếu cần
      if (data.meta) metaForMenu[suttaId] = data.meta;

      htmlContent = ContentCompiler.compileBranch(
          data.bookStructure, 
          data.uid, 
          metaForMenu
      );
      
      document.getElementById("toh-wrapper")?.classList.add("hidden");
  } 
  
  // --- CASE 2: LEAF (Nội dung) ---
  else if (data.content) {
      htmlContent = ContentCompiler.compile(data.content, data.uid);
  } 
  
  else {
      handleNotFound(suttaId);
      return false;
  }

  // Render Footer Nav
  const bottomNavHtml = UIFactory.createBottomNavHtml(
      prevId, 
      nextId, 
      data.navMeta || {} 
  );
  
  container.innerHTML = htmlContent + bottomNavHtml;
  
  // Update Header
  updateTopNavDOM(data, prevId, nextId);

  // Init TOH chỉ cho bài đọc
  if (data.content) {
      if (!tohInstance) tohInstance = setupTableOfHeadings();
      tohInstance.generate();
  }

  return true;
}