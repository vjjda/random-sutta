// Path: web/assets/modules/ui/common/ui_factory.js

const CHEVRON_PATH = "M6 15l6-6 6 6";
function getChevronSvg(rotateDeg, className = "") {
    const style = `transform: rotate(${rotateDeg}deg); transform-origin: center;`;
    return `<svg class="${className}" style="${style}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="${CHEVRON_PATH}"></path>
    </svg>`;
}

export const UIFactory = {
  createErrorHtml: function (suttaId) {
    const scLink = `https://suttacentral.net/${suttaId}/en/sujato`;
    return `
        <div class="error-message">
            <p style="color: #d35400; font-weight: bold; font-size: 1.2rem;">Sutta ID "${suttaId}" not found.</p>
            <p>You can try checking on SuttaCentral:</p>
            <p><a href="${scLink}" target="_blank" rel="noopener noreferrer" class="sc-link">SuttaCentral ➜</a></p>
        </div>`;
  },

  createNavButton: function (suttaId, direction, metaMap) {
    if (!suttaId) return `<div class="nav-spacer"></div>`;

    // [UPDATED Logic]
    let title = suttaId.toUpperCase();
    let subtitle = "";

    if (metaMap && metaMap[suttaId]) {
        const info = metaMap[suttaId];
        // Quy tắc 1: Acronym > UID
        title = info.acronym || title;
        // Quy tắc 2: Translated Title > Original Title > Empty
        subtitle = info.translated_title || info.original_title || "";
    } else {
        // Fallback nhẹ nếu chưa có meta (parse từ ID)
        const match = suttaId.match(/^([a-z]+)(\d.*)$/i);
        if (match) title = `${match[1].toUpperCase()} ${match[2]}`;
    }

    const align = direction === 'left' ? 'left' : 'right';
    const alignItems = direction === 'left' ? 'flex-start' : 'flex-end';
    const arrowIcon = direction === 'left'
        ? getChevronSvg(-90, "nav-icon-inline left")
        : getChevronSvg(90, "nav-icon-inline right");

    const content = direction === 'left' 
        ? `${arrowIcon}<span>${title}</span>`
        : `<span>${title}</span>${arrowIcon}`;

    return `<button onclick="window.loadSutta('${suttaId}')" class="nav-btn" style="align-items:${alignItems}; text-align:${align}">
            <span class="nav-main-text">
                ${content}
            </span>
            <span class="nav-title">${subtitle}</span>
          </button>`;
  },

  createBottomNavHtml: function (prevId, nextId, metaMap) {
    let html = '<div class="sutta-nav">';
    html += this.createNavButton(prevId, 'left', metaMap);
    html += `
      <button onclick="window.triggerRandomSutta()" class="nav-random-icon" title="Random Sutta">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
           <circle cx="12" cy="12" r="2"></circle>
        </svg>
      </button>
    `;
    html += this.createNavButton(nextId, 'right', metaMap);
    
    html += "</div>";
    return html;
  }
};