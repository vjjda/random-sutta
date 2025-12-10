// Path: web/assets/modules/ui/components/toh/dom_renderer.js
import { Scroller } from '../../common/scroller.js';

export const DomRenderer = {
    renderList(items, listElement, callbacks) {
        listElement.innerHTML = "";
        
        items.forEach(item => {
            if (!item.id) return; 

            const li = document.createElement("li");
            li.className = `toh-item ${item.levelClass}`;
            
            const linkWrapper = document.createElement("div"); 
            linkWrapper.className = "toh-link";
            
            // Main Text Row
            const mainTextDiv = document.createElement("div");
            mainTextDiv.className = "toh-main-text";
            if (item.prefix) {
                mainTextDiv.innerHTML = `<span class="toh-prefix">${item.prefix}.</span> ${item.text}`;
            } else {
                mainTextDiv.textContent = item.text;
            }
            linkWrapper.appendChild(mainTextDiv);

            // Sub Text Row (if available)
            if (item.subText) {
                const subTextDiv = document.createElement("div");
                subTextDiv.className = "toh-sub-text";
                subTextDiv.textContent = item.subText;
                linkWrapper.appendChild(subTextDiv);
            }
            
            linkWrapper.onclick = () => {
                Scroller.animateScrollTo(item.id);
                if (callbacks.onItemClick) callbacks.onItemClick();
            };

            li.appendChild(linkWrapper);
            listElement.appendChild(li);
        });
    },

    updateHeader(mode, headerElement) {
        if (!headerElement) return;
        if (mode === 'headings') headerElement.textContent = "Headings";
        else if (mode === 'paragraphs') headerElement.textContent = "Paragraphs";
    }
};