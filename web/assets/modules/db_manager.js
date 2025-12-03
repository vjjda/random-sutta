// Path: web/assets/modules/db_manager.js

export const DB = {
  // ... (Giữ nguyên các hàm findBookContaining, getMeta...)
  findBookContaining: function (suttaId) {
    if (!window.SUTTA_DB) return null;
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      // [UPDATED] Check cả trong meta để tìm Branch
      if (
        (book.content &&
          Object.prototype.hasOwnProperty.call(book.content, suttaId)) ||
        (book.meta && Object.prototype.hasOwnProperty.call(book.meta, suttaId))
      ) {
        return book;
      }
    }
    return null;
  },

  getMeta: function (id) {
    // ... (Giữ nguyên code cũ)
    const book = this.findBookContaining(id);
    if (book && book.meta && book.meta[id]) {
      return book.meta[id];
    }
    if (window.SUTTA_DB) {
      for (const bookKey in window.SUTTA_DB) {
        const b = window.SUTTA_DB[bookKey];
        if (b.meta && b.meta[id]) return b.meta[id];
      }
    }
    return null;
  },

  // ... (Hàm compileHtml giữ nguyên cho Leaf) ...
  compileHtml: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book || !book.content || !book.content[suttaId]) return null;
    // ... (Giữ nguyên logic render leaf cũ)
    const segments = book.content[suttaId];
    // ...
    // Paste lại logic cũ ở đây để đảm bảo không bị mất
    let fullHtml = "";
    const segmentIds = Object.keys(segments).sort((a, b) => {
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
    segmentIds.forEach((segId) => {
      const seg = segments[segId];
      const shortId = segId.includes(":") ? segId.split(":")[1] : segId;
      let contentInner = "";

      if (seg.pli) contentInner += `<span class='pli'>${seg.pli}</span>`;
      if (seg.eng) contentInner += `<span class='eng'>${seg.eng}</span>`;

      if (seg.comm) {
        const safeComm = seg.comm.replace(/'/g, "&#39;");
        contentInner += `<span class='comment-marker' data-comment='${safeComm}'>*</span>`;
      }

      const segmentWrapper = `<span class='segment' id='${shortId}'>${contentInner}</span>`;

      if (seg.html) {
        fullHtml += seg.html.replace("{}", segmentWrapper) + "\n";
      } else {
        fullHtml += `<p>${segmentWrapper}</p>\n`;
      }
    });
    return `<article id='${suttaId}'>${fullHtml}</article>`;
  },

  // [NEW] Hàm tìm node con trong cây Structure
  _findNodeInStructure: function (structure, targetId) {
    if (Array.isArray(structure)) {
      for (const item of structure) {
        const res = this._findNodeInStructure(item, targetId);
        if (res) return res;
      }
    } else if (typeof structure === "object" && structure !== null) {
      // Structure dạng object: { "uid": [...] }
      for (const key in structure) {
        if (key === targetId) return structure[key]; // Tìm thấy! Trả về mảng con
        const res = this._findNodeInStructure(structure[key], targetId);
        if (res) return res;
      }
    }
    return null;
  },

  // [NEW] Tạo HTML cho Branch (Mục lục)
  compileBranchHtml: function (branchId) {
    const book = this.findBookContaining(branchId);
    if (!book) return null;

    const meta = this.getMeta(branchId);
    if (!meta) return null; // Không phải branch hợp lệ

    // 1. Tìm danh sách con
    // [FIX] Luôn ưu tiên dùng _findNodeInStructure để nó tự động "bóc" lớp vỏ { "mn": [...] } ra
    let childrenNode = this._findNodeInStructure(book.structure, branchId);

    // Fallback: Nếu tìm không thấy key (có thể do cấu trúc là mảng phẳng ngay từ đầu)
    // VÀ người dùng đang hỏi đúng ID sách -> Trả về toàn bộ structure coi như là children
    if (!childrenNode && book.id === branchId) {
      childrenNode = book.structure;
    }

    if (!childrenNode) return null;

    // 2. Build Header
    let html = `<div class="branch-container">`;
    html += `<h1 class="branch-title">${
      meta.translated_title || meta.acronym || branchId
    }</h1>`;
    if (meta.original_title) {
      html += `<h2 class="branch-subtitle">${meta.original_title}</h2>`;
    }
    if (meta.blurb) {
      html += `<div class="branch-blurb">${meta.blurb}</div>`;
    }
    html += `<hr class="branch-divider">`;

    // 3. Build List Children
    html += `<ul class="branch-list">`;

      // Helper để duyệt qua childrenNode
      const processItem = (item) => {
          let id, type;
          if (typeof item === 'string') {
              id = item;
              type = 'leaf';
          } else {
              id = Object.keys(item)[0];
              type = 'branch';
          }
          
          const childMeta = this.getMeta(id) || { translated_title: id };
          const title = childMeta.translated_title || childMeta.acronym || id;
          const subtitle = childMeta.original_title || "";
          const blurb = childMeta.blurb || "";
          
          const cssClass = type === 'branch' ? 'branch-link-group' : 'branch-link-leaf';
          const displayText = childMeta.acronym || id;

          // [UPDATED] Logic Layout mới:
          // 1. Leaf: ID nằm bên trái (thay thế icon doc), Info bên phải.
          // 2. Branch: Info bên trái, ID nằm bên phải (badge).
          
          let innerHtml = "";

          if (type === 'leaf') {
              // Layout cho Leaf: [ID] [Info]
              innerHtml = `
                  <span class="b-id-left">${displayText}</span>
                  <div class="b-info">
                      <span class="b-title">${title}</span>
                      ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ''}
                      ${blurb ? `<div class="b-blurb">${blurb}</div>` : ''} 
                  </div>
              `;
          } else {
              // Layout cho Branch: [Info] [ID (bên phải)]
              // Bỏ icon folder
              innerHtml = `
                  <div class="b-info">
                      <span class="b-title">${title}</span>
                      ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ''}
                      ${blurb ? `<div class="b-blurb">${blurb}</div>` : ''} 
                  </div>
                  <span class="b-id-right">${displayText}</span>
              `;
          }

          return `<li class="${cssClass}">
                    <a href="#" onclick="window.loadSutta('${id}'); return false;">
                        ${innerHtml}
                    </a>
                  </li>`;
      };

    if (Array.isArray(childrenNode)) {
      childrenNode.forEach((item) => {
        html += processItem(item);
      });
    } else if (typeof childrenNode === "object") {
      // Trường hợp node con lại là 1 object (ít gặp nhưng cứ handle)
      Object.keys(childrenNode).forEach((key) => {
        // Giả lập format
        html += processItem({ [key]: childrenNode[key] });
      });
    }

    html += `</ul></div>`;
    return html;
  },

  getNavigation: function (suttaId) {
    // ... (Giữ nguyên code cũ)
    const book = this.findBookContaining(suttaId);
    if (!book || !book.structure) return { next: null, prev: null };
    const flatList = this._flattenStructure(book.structure);
    const idx = flatList.indexOf(suttaId);
    if (idx === -1) return { next: null, prev: null };
    return {
      prev: idx > 0 ? flatList[idx - 1] : null,
      next: idx < flatList.length - 1 ? flatList[idx + 1] : null,
    };
  },

  _flattenStructure: function (node, list = []) {
    // ... (Giữ nguyên code cũ)
    if (typeof node === "string") {
      list.push(node);
    } else if (Array.isArray(node)) {
      node.forEach((child) => this._flattenStructure(child, list));
    } else if (typeof node === "object" && node !== null) {
      // Khi flatten để điều hướng, ta chỉ quan tâm LEAF (để nút Next/Prev chạy qua các bài kinh)
      // Nhưng nếu muốn Next/Prev chạy qua cả Branch thì push key vào đây.
      // Hiện tại giữ nguyên logic cũ: Chỉ Leaf mới có Next/Prev.
      Object.values(node).forEach((child) =>
        this._flattenStructure(child, list)
      );
    }
    return list;
  },

  getAllAvailableSuttas: function () {
    // ... (Giữ nguyên code cũ - Hàm này chỉ lấy Leaf từ content -> Random Safe)
    if (!window.SUTTA_DB) return [];
    let allSuttas = [];
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      if (book.content) {
        allSuttas = allSuttas.concat(Object.keys(book.content));
      }
    }
    return allSuttas;
  },
};
