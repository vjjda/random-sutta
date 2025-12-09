// Path: web/assets/modules/ui/components/toh/toh_renderer.js
import { Scroller } from '../../common/scroller.js';

export const TohRenderer = {
    renderList(items, listElement, callbacks) {
        listElement.innerHTML = "";
        
        items.forEach(item => {
            // Tự tạo ID nếu thiếu (đặc biệt cho Heading)
            if (!item.id) return; // Skip if no ID possible

            const li = document.createElement("li");
            li.className = `toh-item ${item.levelClass}`;
            
            const span = document.createElement("span"); 
            span.className = "toh-link";
            
            if (item.prefix) {
                span.innerHTML = `<b>${item.prefix}.</b> ${item.text}`;
            } else {
                span.textContent = item.text;
            }
            
            span.onclick = () => {
                Scroller.animateScrollTo(item.id);
                if (callbacks.onItemClick) callbacks.onItemClick();
            };

            li.appendChild(span);
            listElement.appendChild(li);
        });
    },

    updateHeader(mode, headerElement) {
        if (!headerElement) return;
        if (mode === 'headings') headerElement.textContent = "Headings";
        else if (mode === 'paragraphs') headerElement.textContent = "Paragraphs";
    }
};