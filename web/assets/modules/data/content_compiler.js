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

      // 1. Chuẩn bị nội dung
      const pliText = segment.pli ? `<span class='pli'>${segment.pli}</span>` : "";
      const engText = segment.eng ? `<span class='eng'>${segment.eng}</span>` : "";
      let combinedText = `${pliText}${engText}`;

      if (segment.comm) {
          const safeComm = segment.comm.replace(/"/g, '&quot;').replace(/'/g, "&apos;");
          combinedText += `<span class='comment-marker' data-comment="${safeComm}">*</span>`;
      }

      // 2. Render
      if (segment.html) {
        // CASE A: Template (Verse, Heading...)
        // Bắt buộc dùng Span để không phá vỡ layout của thẻ cha (như h1, blockquote)
        // Dùng class 'segment-text' để CSS có thể target highlight riêng
        const contentPackage = `<span class="segment-text" id="${segmentId}">${combinedText}</span>`;
        text = segment.html.replace("{}", contentPackage);
      } else {
        // CASE B: Đoạn văn thường (90% trường hợp)
        // Gán ID trực tiếp vào thẻ P có class 'segment'. 
        // Đây là cách "database cũ" làm và tương thích tốt nhất với CSS hiện tại.
        text = `<p class='segment' id='${segmentId}'>${combinedText}</p>`;
      }
      
      html += text;
    });

    return html;
  },

  // (Giữ nguyên compileBranch cũ)
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

      if (Array.isArray(children)) {
          children.forEach(child => {
              if (typeof child === 'string') {
                  itemsToRender.push(child);
              } else if (typeof child === 'object' && child !== null) {
                  itemsToRender.push(...Object.keys(child));
              }
          });
      } else if (typeof children === 'object' && children !== null) {
          itemsToRender.push(...Object.keys(children));
      }
      
      itemsToRender.forEach(childId => {
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