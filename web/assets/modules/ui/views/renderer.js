// Path: web/assets/modules/ui/views/renderer.js
import { ContentCompiler } from "../../data/content_compiler.js"; 
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";

let tohInstance = null;

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

export async function renderSutta(suttaId, data, navData, options = {}) {
  const container = document.getElementById("sutta-container");
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  container.innerHTML = "";
  let htmlContent = "";

  if (data.isBranch) {
      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      document.getElementById("toh-wrapper")?.classList.add("hidden");
      
      updateTopNavDOM(data, navData.prev, navData.next); 
      const bottomNavHtml = UIFactory.createBottomNavHtml(navData.prev, navData.next, data.meta);
      container.innerHTML = htmlContent + bottomNavHtml;
      
      return true;
  }

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