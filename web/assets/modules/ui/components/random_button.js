// Path: web/assets/modules/ui/components/random_button.js
import { SuttaController } from "core/sutta_controller.js";
import { ViewManager } from "ui/managers/view_manager.js";
import { ZIndexManager } from "ui/common/z_index_manager.js";

export const RandomButton = {
    init: function() {
        const randomBtn = document.getElementById("btn-random");
        const landingRandomBtn = document.getElementById("btn-landing-random");

        if (landingRandomBtn) {
            landingRandomBtn.addEventListener("click", async () => {
                // [NEW] Show loading state on button
                landingRandomBtn.classList.add("is-loading");
                const spinner = landingRandomBtn.querySelector(".btn-loading-spinner");
                if (spinner) spinner.classList.remove("hidden");

                try {
                    // Wait for random load
                    const success = await SuttaController.loadRandomSutta(true);
                    
                    if (success) {
                        // ONLY switch view if we actually loaded something
                        ViewManager.switchView('reader');
                    } else {
                        // [NEW] If loading failed (e.g. no internet/DB error), 
                        // reset the button so they can try again or see an error.
                        landingRandomBtn.classList.remove("is-loading");
                        if (spinner) spinner.classList.add("hidden");
                    }
                } catch (err) {
                    console.error("Landing Random Click Error:", err);
                    landingRandomBtn.classList.remove("is-loading");
                    if (spinner) spinner.classList.add("hidden");
                }
            });
        }

        if (!randomBtn) return;

        let isLongPress = false;
        let pressTimer;

        const startPress = (e) => {
            // Only handle left click or touch
            if (e.type === 'mousedown' && e.button !== 0) return;
            
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                const popup = document.getElementById("filter-popup");
                if (popup) {
                    ZIndexManager.bringToFront(popup); // Ensure it's above other things
                    popup.classList.remove("hidden");
                    document.body.classList.add("filter-open");
                    if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback on open
                }
            }, 500);
        };

        const cancelPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
        };

        // Prevent default context menu on mobile long press
        randomBtn.addEventListener("contextmenu", (e) => e.preventDefault());
        
        randomBtn.addEventListener("mousedown", startPress);
        randomBtn.addEventListener("touchstart", startPress, { passive: true });
        randomBtn.addEventListener("mouseup", cancelPress);
        randomBtn.addEventListener("mouseleave", cancelPress);
        randomBtn.addEventListener("touchend", cancelPress);
        randomBtn.addEventListener("touchcancel", cancelPress);

        randomBtn.addEventListener("click", (e) => {
            if (isLongPress) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            SuttaController.loadRandomSutta(true);
        });
    }
};
