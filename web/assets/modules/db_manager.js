// Path: web/assets/modules/db_manager.js

export const DB = {
  findBookContaining: function (suttaId) {
    if (!window.SUTTA_DB) return null;
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      if (book.content && Object.prototype.hasOwnProperty.call(book.content, suttaId)) {
        return book;
      }
    }
    return null;
  },

  getMeta: function (id) {
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

  compileHtml: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book) return null;

    const segments = book.content[suttaId];
    if (!segments) return null;

    let fullHtml = "";
    const segmentIds = Object.keys(segments).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

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

      if (seg.html) {
          fullHtml += seg.html.replace("{}", segmentWrapper) + "\n";
      } else {
          fullHtml += `<p>${segmentWrapper}</p>\n`;
      }
    });

    return `<article id='${suttaId}'>${fullHtml}</article>`;
  },

  getNavigation: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book || !book.structure) return { next: null, prev: null };

    const flatList = this._flattenStructure(book.structure);
    const idx = flatList.indexOf(suttaId);

    if (idx === -1) return { next: null, prev: null };

    return {
      prev: idx > 0 ? flatList[idx - 1] : null,
      next: idx < flatList.length - 1 ? flatList[idx + 1] : null
    };
  },

  _flattenStructure: function (node, list = []) {
    if (typeof node === 'string') {
        list.push(node);
    } else if (Array.isArray(node)) {
      node.forEach(child => this._flattenStructure(child, list));
    } else if (typeof node === 'object' && node !== null) {
      Object.values(node).forEach(child => this._flattenStructure(child, list));
    }
    return list;
  },

  getAllAvailableSuttas: function() {
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