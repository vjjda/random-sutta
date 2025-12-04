// Path: web/assets/modules/db_manager.js
import { calculateNavigation } from './navigator.js'; // [NEW] Import logic

export const DB = {
  // ... (findBookContaining, getMeta GIỮ NGUYÊN) ...
  findBookContaining: function (suttaId) {
    if (!window.SUTTA_DB) return null;
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      if ((book.content && Object.prototype.hasOwnProperty.call(book.content, suttaId)) ||
          (book.meta && Object.prototype.hasOwnProperty.call(book.meta, suttaId))) {
        return book;
      }
    }
    return null;
  },

  getMeta: function (id) {
      const book = this.findBookContaining(id);
      if (book && book.meta && book.meta[id]) return book.meta[id];
      if (window.SUTTA_DB) {
        for (const bookKey in window.SUTTA_DB) {
          const b = window.SUTTA_DB[bookKey];
          if (b.meta && b.meta[id]) return b.meta[id];
        }
      }
      return null;
  },

  // ... (compileHtml cho Leaf GIỮ NGUYÊN) ...
  compileHtml: function (suttaId) {
      // (Giữ nguyên code cũ của bạn ở đây - không thay đổi)
      const book = this.findBookContaining(suttaId);
      if (!book || !book.content || !book.content[suttaId]) return null;
      // ... logic render HTML cho bài kinh ...
      // (Copy paste lại phần render segment để đảm bảo code chạy)
      const segments = book.content[suttaId];
      let fullHtml = "";
      const segmentIds = Object.keys(segments).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      segmentIds.forEach((segId) => {
          const seg = segments[segId];
          const shortId = segId.includes(':') ? segId.split(':')[1] : segId;
          let contentInner = "";
          if (seg.pli) contentInner += `<span class='pli'>${seg.pli}</span>`;
          if (seg.eng) contentInner += `<span class='eng'>${seg.eng}</span>`;
          if (seg.comm) {
             const safeComm = seg.comm.replace(/'/g, "&#39;");
             contentInner += `<span class='comment-marker' data-comment='${safeComm}'>*</span>`;
          }
          const segmentWrapper = `<span class='segment' id='${shortId}'>${contentInner}</span>`;
          if (seg.html) fullHtml += seg.html.replace("{}", segmentWrapper) + "\n";
          else fullHtml += `<p>${segmentWrapper}</p>\n`;
      });
      return `<article id='${suttaId}'>${fullHtml}</article>`;
  },

  // ... (compileBranchHtml GIỮ NGUYÊN - đã tối ưu ở bước trước) ...
  _findNodeInStructure: function(structure, targetId) {
      if (Array.isArray(structure)) {
          for (const item of structure) {
              const res = this._findNodeInStructure(item, targetId);
              if (res) return res;
          }
      } else if (typeof structure === 'object' && structure !== null) {
          for (const key in structure) {
              if (key === targetId) return structure[key];
              const res = this._findNodeInStructure(structure[key], targetId);
              if (res) return res;
          }
      }
      return null;
  },

  compileBranchHtml: function(branchId) {
      const book = this.findBookContaining(branchId);
      if (!book) return null;
      const meta = this.getMeta(branchId);
      if (!meta) return null;

      let childrenNode = this._findNodeInStructure(book.structure, branchId);
      if (!childrenNode && book.id === branchId) childrenNode = book.structure;
      if (!childrenNode) return null;

      let html = `<div class="branch-container">`;
      html += `<h1 class="branch-title">${meta.translated_title || meta.acronym || branchId}</h1>`;
      if (meta.original_title) html += `<h2 class="branch-subtitle">${meta.original_title}</h2>`;
      if (meta.blurb) html += `<div class="branch-blurb">${meta.blurb}</div>`;
      html += `<hr class="branch-divider">`;
      html += `<ul class="branch-list">`;
      
      const processItem = (item) => {
          // (Giữ nguyên logic Card Layout mới nhất bạn đã duyệt)
          let id, type;
          if (typeof item === 'string') { id = item; type = 'leaf'; } 
          else { id = Object.keys(item)[0]; type = 'branch'; }
          
          const childMeta = this.getMeta(id) || { translated_title: id };
          const title = childMeta.translated_title || childMeta.acronym || id;
          const subtitle = childMeta.original_title || "";
          const blurb = childMeta.blurb || "";
          const displayText = childMeta.acronym || id;
          const cssClass = type === 'branch' ? 'branch-card-group' : 'branch-card-leaf';

          return `<li class="${cssClass}">
                    <a href="#" onclick="window.loadSutta('${id}'); return false;" class="b-card-link">
                        <div class="b-content">
                            <div class="b-header">
                                <span class="b-title">${title}</span>
                                ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ''}
                            </div>
                            ${blurb ? `<div class="b-blurb">${blurb}</div>` : ''} 
                            <div class="b-footer"><span class="b-badge">${displayText}</span></div>
                        </div>
                    </a>
                  </li>`;
      };

      if (Array.isArray(childrenNode)) {
          childrenNode.forEach(item => html += processItem(item));
      } else if (typeof childrenNode === 'object') {
           Object.keys(childrenNode).forEach(key => html += processItem({ [key]: childrenNode[key] }));
      }
      html += `</ul></div>`;
      return html;
  },

  // [REFACTORED] Hàm điều hướng giờ gọi sang Module Navigator
  getNavigation: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book || !book.structure) return { next: null, prev: null };

    // Ủy quyền tính toán cho Navigator
    return calculateNavigation(book.structure, suttaId);
  },

  getAllAvailableSuttas: function() {
      // (Giữ nguyên)
      if (!window.SUTTA_DB) return [];
      let allSuttas = [];
      for (const bookKey in window.SUTTA_DB) {
          const book = window.SUTTA_DB[bookKey];
          if (book.content) {
              allSuttas = allSuttas.concat(Object.keys(book.content));
          }
      }
      return allSuttas;
  }
};