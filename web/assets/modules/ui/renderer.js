// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";
import { DB } from "../data/db_manager.js";

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

export async function renderSutta(suttaId, data, options = {}) {
  const container = document.getElementById("sutta-container");
  
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  container.innerHTML = "";
  let htmlContent = "";

  // [CALCULATE NAVIGATION] - Dùng chung cho cả Leaf và Branch
  // navigator.js đã có logic tìm sibling cùng level (depth)
  const nav = calculateNavigation(data.bookStructure, data.uid);

  // --- CASE 1: BRANCH VIEW (Mục lục) ---
  if (data.isBranch) {
      function getChildrenIds(structure, currentUid) {
          function findNode(node, targetId) {
              if (!node) return null;
              if (Array.isArray(node)) {
                  for (let item of node) {
                      if (item[targetId]) return item[targetId];
                      const found = findNode(item, targetId);
                      if (found) return found;
                  }
                  return null;
              }
              if (typeof node === 'object') {
                  if (node[targetId]) return node[targetId];
                  for (let key in node) {
                      if (key === 'meta' || typeof node[key] !== 'object') continue;
                      const found = findNode(node[key], targetId);
                      if (found) return found;
                  }
              }
              return null;
          }
          
          const node = structure[currentUid] ? structure[currentUid] : findNode(structure, currentUid);
          if (!node) return [];
          
          let ids = [];
          if (Array.isArray(node)) {
              node.forEach(item => {
                  if (typeof item === 'string') ids.push(item);
                  else if (typeof item === 'object') ids.push(...Object.keys(item));
              });
          } else if (typeof node === 'object') {
              ids = Object.keys(node);
          }
          return ids;
      }

      const childrenIds = getChildrenIds(data.bookStructure, data.uid);
      
      if (childrenIds.length > 0) {
          const leavesToFetch = childrenIds.filter(id => !data.meta[id]);
          if (leavesToFetch.length > 0) {
              const leafMetas = await DB.fetchMetaForUids(leavesToFetch);
              Object.assign(data.meta, leafMetas);
          }
      }

      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      
      document.getElementById("toh-wrapper")?.classList.add("hidden");
      
      // [FIXED] Kích hoạt Navigation cho Branch
      updateTopNavDOM(data, nav.prev, nav.next); 
      
      // Thêm Bottom Nav
      const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
      container.innerHTML = htmlContent + bottomNavHtml;
      
      return true;
  }

  // --- CASE 2: LEAF VIEW (Bài kinh) ---
  if (!data.content) {
      handleNotFound(suttaId);
      return false;
  }

  htmlContent = ContentCompiler.compile(data.content, data.uid);
  
  updateTopNavDOM(data, nav.prev, nav.next);
  
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.meta);
  container.innerHTML = htmlContent + bottomNavHtml;

  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}