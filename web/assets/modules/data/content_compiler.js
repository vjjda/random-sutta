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

  // [FIXED] Hàm render Branch View hỗ trợ Mixed Array
  compileBranch: function(structure, currentUid, metaMap) {
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

      const children = findNode(structure, currentUid);

      if (!children) {
          return `<div class="error-message">
              <p>No items found in this section (${currentUid}).</p>
          </div>`;
      }

      let html = `<div class="branch-container">`;
      let itemsToRender = [];

      // [LOGIC MỚI] Duyệt an toàn từng phần tử
      if (Array.isArray(children)) {
          children.forEach(child => {
              if (typeof child === 'string') {
                  // Trường hợp 1: Là UID Leaf (Ví dụ "mn1")
                  itemsToRender.push(child);
              } else if (typeof child === 'object' && child !== null) {
                  // Trường hợp 2: Là Branch con (Ví dụ {"vagga1": [...]})
                  // Lấy tên Branch (Key) để hiển thị
                  itemsToRender.push(...Object.keys(child));
              }
          });
      } else if (typeof children === 'object' && children !== null) {
          // Trường hợp 3: Là Object map (Ví dụ {"vagga1": ..., "vagga2": ...})
          itemsToRender.push(...Object.keys(children));
      }
      
      // Render Cards
      itemsToRender.forEach(childId => {
          // [SAFETY CHECK] Chỉ render nếu childId là chuỗi hợp lệ
          if (typeof childId !== 'string') return;

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
              // Fallback
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