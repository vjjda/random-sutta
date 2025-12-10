// Path: web/assets/modules/ui/components/toh/dom_renderer.js
import { Scroller } from '../../common/scroller.js';

export const DomRenderer = {
    renderList(items, listElement, callbacks) {
        listElement.innerHTML = "";
        
        items.forEach(item => {
            if (!item.id) return; 

            const li = document.createElement("li");
            li.className = `toh-item ${item.levelClass}`;
            li.dataset.targetId = item.id; // Store ID for active state detection
            
            const wrapper = document.createElement("div"); 
            wrapper.className = "toh-item-wrapper collapsed"; // Default collapsed
            
            // --- 1. Header Row ---
            const headerRow = document.createElement("div");
            headerRow.className = "toh-header-row";
            
            // Main Text
            const mainTextDiv = document.createElement("div");
            mainTextDiv.className = "toh-main-text clickable";
            if (item.prefix) {
                mainTextDiv.innerHTML = `<span class="toh-prefix">${item.prefix}.</span> ${item.text}`;
            } else {
                mainTextDiv.textContent = item.text;
            }
            
            mainTextDiv.onclick = (e) => {
                e.stopPropagation();
                Scroller.animateScrollTo(item.id);
                if (callbacks.onItemClick) callbacks.onItemClick();
            };
            headerRow.appendChild(mainTextDiv);

            // Toggle Icon (Only if subTexts exist and array is not empty)
            const hasChildren = item.subTexts && Array.isArray(item.subTexts) && item.subTexts.length > 0;
            if (hasChildren) {
                const toggleBtn = document.createElement("span");
                toggleBtn.className = "toh-toggle-icon";
                toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    wrapper.classList.toggle("collapsed");
                };
                headerRow.appendChild(toggleBtn);
            }

            wrapper.appendChild(headerRow);

            // --- 2. Children Container ---
            if (hasChildren) {
                const childrenContainer = document.createElement("div");
                childrenContainer.className = "toh-children";
                
                item.subTexts.forEach(sub => {
                    const subDiv = document.createElement("div");
                    subDiv.className = "toh-sub-text clickable";
                    subDiv.textContent = sub.text;
                    if (sub.id) subDiv.dataset.targetId = sub.id; // Store ID

                    if (sub.id) {
                        subDiv.onclick = (e) => {
                            e.stopPropagation();
                            Scroller.animateScrollTo(sub.id);
                            if (callbacks.onItemClick) callbacks.onItemClick();
                        };
                    } else {
                        subDiv.classList.add("disabled"); // Visual hint if not clickable
                    }
                    childrenContainer.appendChild(subDiv);
                });
                wrapper.appendChild(childrenContainer);
            } 
            // Legacy/Paragraph Mode support (single subText)
            else if (item.subText) {
                const subDiv = document.createElement("div");
                subDiv.className = "toh-sub-text";
                subDiv.textContent = item.subText;
                wrapper.appendChild(subDiv);
            }

            li.appendChild(wrapper);
            listElement.appendChild(li);
        });
    },

    updateHeader(mode, headerElement) {
        if (!headerElement) return;
        if (mode === 'headings') headerElement.textContent = "Headings";
        else if (mode === 'paragraphs') headerElement.textContent = "Paragraphs";
    },

    updateActiveState(targetId) {
        const list = document.getElementById("toh-list");
        if (!list) return;

        // 1. Clear active
        const actives = list.querySelectorAll(".active");
        actives.forEach(el => el.classList.remove("active"));

        if (!targetId) return;

        // 2. Find target (element has dataset.targetId, could be li > wrapper > headerRow or subDiv)
        // Note: dataset.targetId was set on `li` and `subDiv`. 
        // For headings, the `li` has the ID, but we want to highlight the `.toh-header-row` inside it.
        
        let targetEl = list.querySelector(`.toh-sub-text[data-target-id="${targetId}"]`);
        
        if (!targetEl) {
            // Check for li
            const li = list.querySelector(`li[data-target-id="${targetId}"]`);
            if (li) {
                targetEl = li.querySelector(".toh-header-row");
            }
        }

        if (targetEl) {
            targetEl.classList.add("active");

            // Auto-expand if sub-text
            if (targetEl.classList.contains("toh-sub-text")) {
                const wrapper = targetEl.closest(".toh-item-wrapper");
                if (wrapper) wrapper.classList.remove("collapsed");
            }

            // Scroll
            targetEl.scrollIntoView({ block: "center", behavior: "instant" });
        }
    }
};