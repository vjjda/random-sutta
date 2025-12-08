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
            btn.title = "End of list";
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

  // --- CASE 1: BRANCH / MENU ---
  if (data.bookStructure && !data.content) {
      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.contextMeta || {});
      document.getElementById("toh-wrapper")?.classList.add("hidden");
  } 
  
  // --- CASE 2: LEAF (Nội dung) ---
  else if (data.content) {
      htmlContent = ContentCompiler.compile(data.content, data.uid);
      
      // [FIX] REMOVED: Đoạn code tự inject <header><h1>...</h1> đã bị xóa theo yêu cầu
      // Header giờ chỉ nằm ở thanh điều hướng dính (sticky nav)
  } 
  
  else {
      handleNotFound(suttaId);
      return false;
  }

  const bottomNavHtml = UIFactory.createBottomNavHtml(
      prevId, 
      nextId, 
      data.navMeta || {} 
  );
  
  container.innerHTML = htmlContent + bottomNavHtml;
  
  updateTopNavDOM(data, prevId, nextId);

  if (data.content) {
      if (!tohInstance) tohInstance = setupTableOfHeadings();
      tohInstance.generate();
  }

  return true;
}