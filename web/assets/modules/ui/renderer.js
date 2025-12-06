// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js";
import { DB } from "../data/db_manager.js"; // [NEW] Import DB

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
    // ... (Giữ nguyên logic cũ) ...
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

// [UPDATED] chuyển thành async để await DB.fetchMetaForUids
export async function renderSutta(suttaId, data, options = {}) {
  const container = document.getElementById("sutta-container");
  
  if (!data) {
    handleNotFound(suttaId);
    return false;
  }

  container.innerHTML = "";
  let htmlContent = "";

  // --- CASE 1: BRANCH VIEW ---
  if (data.isBranch) {
      // 1. Lấy danh sách con (IDs)
      // Ta cần một helper để extract ID list từ data.bookStructure tương ứng với data.uid
      // Tái sử dụng logic tìm node trong ContentCompiler (nhưng ở đây ta cần IDs trước)
      
      // Để đơn giản, ta gọi ContentCompiler.compileBranch 2 lần? 
      // Không, ta sửa ContentCompiler.compileBranch trả về list ID cần fetch, 
      // hoặc ta tự traverse ở đây.
      
      // Tạm thời ta gọi compileBranch, bên trong đó sẽ detect thiếu meta và fallback ID.
      // Nhưng để "Rich View", ta cần fetch meta trước.
      
      // -- Helper Traverse --
      function getChildrenIds(structure, currentUid) {
          // (Logic traverse giống ContentCompiler.compileBranch nhưng chỉ return array ID)
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
              if (node.length > 0 && typeof node[0] === 'object') {
                  node.forEach(obj => ids.push(...Object.keys(obj)));
              } else {
                  ids = node;
              }
          } else {
              ids = Object.keys(node);
          }
          return ids;
      }
      // ---------------------

      const childrenIds = getChildrenIds(data.bookStructure, data.uid);
      
      // 2. Fetch Meta cho Children (Lazy Load Chunks)
      if (childrenIds.length > 0) {
          // Nếu children là Leaf (không có trong data.meta), thì tải chunk
          // Nếu children là Branch (có trong data.meta), không cần tải
          const leavesToFetch = childrenIds.filter(id => !data.meta[id]);
          
          if (leavesToFetch.length > 0) {
              // Hiển thị loading nhẹ nếu cần
              const leafMetas = await DB.fetchMetaForUids(leavesToFetch);
              // Merge vào data.meta để Compiler dùng
              Object.assign(data.meta, leafMetas);
          }
      }

      htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.meta);
      
      document.getElementById("toh-wrapper")?.classList.add("hidden");
      updateTopNavDOM(data, null, null); 
      container.innerHTML = htmlContent;
      return true;
  }

  // --- CASE 2: LEAF VIEW ---
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