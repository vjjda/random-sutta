// Path: web/assets/modules/ui/views/renderer.js
import { ContentCompiler } from "../../data/content_compiler.js"; 
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";

let tohInstance = null;

function getDisplayInfo(uid, metaSource) {
    let main = uid.toUpperCase();
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    let info = null;
    if (metaSource) {
        // Case 1: metaSource là một Object meta đơn lẻ (của bài chính)
        if (metaSource.acronym || metaSource.translated_title) {
             info = metaSource;
        } 
        // Case 2: metaSource là Map { uid: meta } (của navMeta)
        else if (metaSource[uid]) {
             info = metaSource[uid];
        }
    }

    if (info) {
        return { 
            main: info.acronym || main, 
            sub: info.translated_title || info.original_title || "" 
        };
    }
    return { main: main, sub: "" };
}

function updateTopNavDOM(data, prevId, nextId) {
    const navHeader = document.getElementById("nav-header");
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    const statusDiv = document.getElementById("status");

    // Hiển thị Title bài chính (dùng data.meta)
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
            
            // Hiển thị Tooltip cho Prev/Next (dùng data.navMeta)
            const neighborInfo = getDisplayInfo(targetId, data.navMeta);
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

export async function renderSutta(suttaId, data, navData, options = {}) {
  const container = document.getElementById("sutta-container");
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  container.innerHTML = "";
  let htmlContent = "";

  // Render Branch (Mục lục)
  if (data.isBranch) {
      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      document.getElementById("toh-wrapper")?.classList.add("hidden");
      
      updateTopNavDOM(data, navData.prev, navData.next);
      const bottomNavHtml = UIFactory.createBottomNavHtml(navData.prev, navData.next, data.navMeta); // Dùng navMeta
      container.innerHTML = htmlContent + bottomNavHtml;
      
      return true;
  }

  // Render Content
  if (!data.content) {
      handleNotFound(suttaId);
      return false;
  }

  htmlContent = ContentCompiler.compile(data.content, data.uid);
  updateTopNavDOM(data, navData.prev, navData.next);
  const bottomNavHtml = UIFactory.createBottomNavHtml(navData.prev, navData.next, data.navMeta); // Dùng navMeta
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();
  return true;
}