// Path: web/assets/modules/ui_factory.js
import { getSuttaDisplayInfo } from './utils.js';

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
    
    // [CHANGED] Chevron Left
    const arrowLeft = direction === 'left'
        ? `<svg class="nav-icon-inline left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`
        : "";
    
    // [CHANGED] Chevron Right
    const arrowRight = direction === 'right'
        ? `<svg class="nav-icon-inline right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`
        : "";

    return `<button onclick="window.loadSutta('${suttaId}')" class="nav-btn" style="align-items:${alignItems}; text-align:${align}">
            <span class="nav-main-text">
                ${arrowLeft}
                <span>${info.title}</span>
                ${arrowRight}
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