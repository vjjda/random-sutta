// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
  compile: function (contentData, rootId) {
    if (!contentData) return "";

    let html = "";
    
    const sortedKeys = Object.keys(contentData).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedKeys.forEach((segmentId) => {
      const segment = contentData[segmentId];
      if (!segment) return;

      let text = "";
      const pliText = segment.pli ? `<span class='pli'>${segment.pli}</span>` : "";
      const engText = segment.eng ? `<span class='eng'>${segment.eng}</span>` : "";
      const combinedText = `${pliText}${engText}`;

      if (segment.html) {
        text = segment.html.replace("{}", combinedText);
      } else {
        text = `<p class='segment' id='${segmentId}'>${combinedText}`;
        if (segment.comm) {
            const safeComm = segment.comm.replace(/"/g, '&quot;').replace(/'/g, "&apos;");
            text += `<span class='comment-marker' data-comment="${safeComm}">*</span>`;
        }
        text += "</p>";
      }
      html += text;
    });

    return html;
  },

  // [FIXED] Hàm render Branch View hỗ trợ cả Array và Object Structure
  compileBranch: function(structure, currentUid, metaMap) {
      // Hàm đệ quy tìm node con của currentUid trong cây
      function findNode(node, targetId) {
          if (!node) return null;

          // 1. Nếu node là Array (trường hợp Super Book)
          // Duyệt qua từng phần tử để tìm
          if (Array.isArray(node)) {
              for (let item of node) {
                  // Nếu phần tử là object và có key == targetId -> Found
                  if (item[targetId]) return item[targetId];
                  
                  // Nếu không, đệ quy tìm tiếp bên trong
                  const found = findNode(item, targetId);
                  if (found) return found;
              }
              return null;
          }

          // 2. Nếu node là Object
          if (typeof node === 'object') {
              // Check trực tiếp
              if (node[targetId]) return node[targetId];

              // Đệ quy check properties
              for (let key in node) {
                  // Bỏ qua meta key nếu nó lọt vào đây (thường không)
                  if (key === 'meta' || typeof node[key] !== 'object') continue;
                  
                  const found = findNode(node[key], targetId);
                  if (found) return found;
              }
          }
          
          return null;
      }

      // Tìm danh sách con
      const children = findNode(structure, currentUid);

      if (!children) {
          return `<div class="error-message">
              <p>No items found in this section (${currentUid}).</p>
          </div>`;
      }

      let html = `<div class="branch-container">`;
      
      // Chuẩn hóa children thành mảng keys để loop
      // Nếu children là Array (Leaf list): ["mn1", "mn2"]
      // Nếu children là Object (Sub-branches): { "long": [...], "middle": [...] } -> keys ["long", "middle"]
      // TH đặc biệt: Super struct trả về Array các object: [{"long":...}, {"middle":...}]
      
      let itemsToRender = [];

      if (Array.isArray(children)) {
          // Check xem mảng này chứa String (Leaf) hay Object (Sub-branch trong Super struct)
          if (children.length > 0 && typeof children[0] === 'object') {
               // Trường hợp: [{"long": [...]}, {"middle": [...]}]
               children.forEach(childObj => {
                   itemsToRender.push(...Object.keys(childObj));
               });
          } else {
               // Trường hợp: ["mn1", "mn2"]
               itemsToRender = children;
          }
      } else if (typeof children === 'object') {
          // Trường hợp: {"sub-vagga-1": [...], "sub-vagga-2": [...]}
          itemsToRender = Object.keys(children);
      }
      
      // Render Cards
      itemsToRender.forEach(childId => {
          const info = metaMap[childId];
          
          if (info) {
              const title = info.translated_title || info.original_title || childId.toUpperCase();
              const subtitle = info.translated_title ? info.original_title : "";
              const blurb = info.blurb || "";
              const typeClass = (info.type === 'branch' || info.type === 'root' || info.type === 'group') ? 'branch-card-group' : 'branch-card-leaf';
              
              html += `
              <div class="${typeClass}">
                  <a href="?q=${childId}" class="b-card-link" onclick="event.preventDefault(); window.loadSutta('${childId}', true);">
                      <div class="b-content">
                          <div class="b-header">
                              <span class="b-title">${info.acronym || childId.toUpperCase()} - ${title}</span>
                              ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ""}
                          </div>
                          ${blurb ? `<div class="b-blurb">${blurb}</div>` : ""}
                      </div>
                  </a>
              </div>`;
          } else {
              // Fallback nếu thiếu meta (hiếm gặp)
              html += `
              <div class="branch-card-leaf">
                  <a href="?q=${childId}" class="b-card-link" onclick="event.preventDefault(); window.loadSutta('${childId}', true);">
                      <div class="b-content"><span class="b-title">${childId.toUpperCase()}</span></div>
                  </a>
              </div>`;
          }
      });
      
      html += `</div>`;
      return html;
  }
};