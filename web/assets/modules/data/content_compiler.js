// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
  compile: function (contentData, rootId) {
    if (!contentData) return "";

    let html = "";
    
    // Sắp xếp thứ tự segment
    const sortedKeys = Object.keys(contentData).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedKeys.forEach((segmentId) => {
      const segment = contentData[segmentId];
      if (!segment) return;

      // 1. Tổng hợp nội dung bên trong (Pali + Eng + Comment) 
      let contentInner = "";
      
      if (segment.pli) contentInner += `<span class='pli'>${segment.pli}</span>`;
      if (segment.eng) contentInner += `<span class='eng'>${segment.eng}</span>`;
      
      // Khôi phục hiển thị Comment
      if (segment.comm) {
          const safeComm = segment.comm.replace(/"/g, '&quot;').replace(/'/g, "&apos;");
          contentInner += `<span class='comment-marker' data-comment="${safeComm}">*</span>`;
      }

      // 2. Render HTML và Gán ID
      if (segment.html) {
        // [QUAN TRỌNG] Bọc nội dung trong thẻ SPAN có ID để trình duyệt scroll được tới đây
        // Ngay cả khi nó nằm trong thẻ <blockquote> hay <h2>
        const wrappedContent = `<span id="${segmentId}">${contentInner}</span>`;
        html += segment.html.replace("{}", wrappedContent);
      } else {
        // Đoạn văn thường: Gán ID trực tiếp vào thẻ P để CSS .segment hoạt động tốt nhất
        html += `<p class='segment' id='${segmentId}'>${contentInner}</p>`;
      }
    });

    return html;
  },

  // (Giữ nguyên hàm compileBranch ổn định từ phiên bản trước)
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

      let html = `<div class="branch-container"><ul>`;
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
          
          const title = info ? (info.translated_title || info.acronym || childId.toUpperCase()) : childId.toUpperCase();
          const subtitle = info ? (info.original_title || "") : "";
          const blurb = info ? (info.blurb || "") : "";
          const displayText = info ? (info.acronym || childId.toUpperCase()) : childId.toUpperCase();
          
          const type = info ? info.type : 'leaf';
          const cssClass = (type === 'branch' || type === 'root' || type === 'group') ? 'branch-card-group' : 'branch-card-leaf';

          html += `<li class="${cssClass}">
                      <a href="?q=${childId}" class="b-card-link" onclick="event.preventDefault(); window.loadSutta('${childId}', true);">
                          <div class="b-content">
                              <div class="b-header">
                                  <span class="b-title">${title}</span>
                                  ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ""}
                              </div>
                              ${blurb ? `<div class="b-blurb">${blurb}</div>` : ""}
                              <div class="b-footer"><span class="b-badge">${displayText}</span></div>
                          </div>
                      </a>
                  </li>`;
      });
      
      html += `</ul></div>`;
      return html;
  }
};