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
      if (segment.html) {
        const combinedText = `${segment.pli ? `<span class='pli'>${segment.pli}</span>` : ""}${segment.eng ? `<span class='eng'>${segment.eng}</span>` : ""}`;
        text = segment.html.replace("{}", combinedText);
      } else {
        const pliHtml = segment.pli ? `<span class='pli'>${segment.pli}</span>` : "";
        const engHtml = segment.eng ? `<span class='eng'>${segment.eng}</span>` : "";
        text = `<p class='segment' id='${segmentId}'>${pliHtml}${engHtml}`;
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

  // [NEW] Hàm render Branch View (Card lists)
  compileBranch: function(structure, currentUid, metaMap) {
      // 1. Tìm node hiện tại trong cây Structure
      // Structure là object lồng nhau. Cần hàm đệ quy tìm children của currentUid.
      
      let children = null;
      
      // Hàm đệ quy tìm node
      function findNode(node) {
          if (Array.isArray(node)) return null; // Leaf array
          if (node[currentUid]) return node[currentUid]; // Found it!
          
          for (let key in node) {
              if (typeof node[key] === 'object') {
                  const result = findNode(node[key]);
                  if (result) return result;
              }
          }
          return null;
      }

      // Root check (nếu currentUid chính là root key, ví dụ 'an')
      if (structure[currentUid]) {
          children = structure[currentUid];
      } else {
          children = findNode(structure);
      }

      if (!children) return "<p class='placeholder'>No items found in this section.</p>";

      // 2. Render Cards
      let html = `<div class="branch-container">`;
      
      // Children có thể là Array (list of leaves) hoặc Object (list of sub-branches)
      const keys = Array.isArray(children) ? children : Object.keys(children);
      
      keys.forEach(key => {
          // Nếu là Object (Branch con), key chính là UID. Nếu Array (Leaf), item là UID.
          const childId = key;
          const info = metaMap[childId];
          
          if (info) {
              const title = info.translated_title || info.original_title || childId.toUpperCase();
              const subtitle = info.translated_title ? info.original_title : "";
              const blurb = info.blurb || "";
              
              // CSS class tùy loại
              const typeClass = (info.type === 'branch' || info.type === 'root') ? 'branch-card-group' : 'branch-card-leaf';
              
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
          }
      });
      
      html += `</div>`;
      return html;
  }
};