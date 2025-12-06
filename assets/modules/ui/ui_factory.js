// Path: web/assets/modules/ui/ui_factory.js
import { getSuttaDisplayInfo } from '../data/sutta_info_provider.js';

// [CONSTANT] Chevron hướng lên (Up) làm gốc
// Path: Đi từ trái dưới (6,15) lên đỉnh (12,9) rồi xuống phải dưới (18,15)
const CHEVRON_PATH = "M6 15l6-6 6 6";

/**
 * Helper tạo SVG Chevron xoay theo góc chỉ định.
 * Base: UP (0deg)
 */
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

  createNavButton: function (suttaId, direction) {
    if (!suttaId) return `<div class="nav-spacer"></div>`;

    const info = getSuttaDisplayInfo(suttaId);
    const align = direction === 'left' ? 'left' : 'right';
    const alignItems = direction === 'left' ? 'flex-start' : 'flex-end';
    
    // [LOGIC] Xoay icon dựa trên hướng Up
    // Left (<): Xoay -90 độ
    // Right (>): Xoay 90 độ
    const arrowIcon = direction === 'left'
        ? getChevronSvg(-90, "nav-icon-inline left")
        : getChevronSvg(90, "nav-icon-inline right");

    // Đặt icon vào đúng vị trí (trước hoặc sau text)
    const content = direction === 'left' 
        ? `${arrowIcon}<span>${info.title}</span>`
        : `<span>${info.title}</span>${arrowIcon}`;

    return `<button onclick="window.loadSutta('${suttaId}')" class="nav-btn" style="align-items:${alignItems}; text-align:${align}">
            <span class="nav-main-text">
                ${content}
            </span>
            <span class="nav-title">${info.subtitle}</span>
          </button>`;
  },

  createBottomNavHtml: function (prevId, nextId) {
    let html = '<div class="sutta-nav">';
    // Previous Button
    html += this.createNavButton(prevId, 'left');
    
    // Random Dot (Middle)
    html += `
      <button onclick="window.triggerRandomSutta()" class="nav-random-icon" title="Random Sutta">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
           <circle cx="12" cy="12" r="2"></circle>
        </svg>
      </button>
    `;
    
    // Next Button
    html += this.createNavButton(nextId, 'right');
    
    html += "</div>";
    return html;
  }
};

export const ICONS = {
    CHEVRON_UP: CHEVRON_PATH
};