// Path: web/assets/modules/ui/managers/theme_manager.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("ThemeManager");

export const ThemeManager = {
    init() {
        const btn = document.getElementById("btn-theme-toggle");
        const iconMoon = btn?.querySelector(".icon-moon");
        const iconSun = btn?.querySelector(".icon-sun");
        
        // [NEW] Sepia Elements
        const sepiaPanel = document.getElementById("sepia-control-panel");
        const sepiaSlider = document.getElementById("sepia-slider");

        // 1. Load Theme State
        const storedTheme = localStorage.getItem("sutta_theme");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        let currentTheme = storedTheme || (systemPrefersDark ? "dark" : "light");

        // 2. Load Sepia State
        const storedSepia = localStorage.getItem("sutta_sepia") || 0;
        
        // --- Functions ---

        const applyTheme = (theme) => {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem("sutta_theme", theme);
            currentTheme = theme;
            
            if (theme === "dark") {
                iconMoon?.classList.add("hidden");
                iconSun?.classList.remove("hidden");
            } else {
                iconMoon?.classList.remove("hidden");
                iconSun?.classList.add("hidden");
            }
        };

        const applySepia = (value) => {
            document.documentElement.style.setProperty('--sepia-amount', `${value}%`);
            localStorage.setItem("sutta_sepia", value);
        };

        // Init Apply
        applyTheme(currentTheme);
        applySepia(storedSepia);
        if (sepiaSlider) sepiaSlider.value = storedSepia;

        // --- Event Handling (Double Tap Logic) ---
        
        if (btn) {
            let lastTapTime = 0;
            let clickTimer = null;
            let globalLastTouchTime = 0; // Anti-ghost click variable

            const handleAction = (e) => {
                const now = Date.now();

                // [LOGIC TỪ FILTER_GESTURES] Chặn Ghost Clicks
                if (e.type === 'mousedown' && (now - globalLastTouchTime < 800)) {
                    return;
                }
                if (e.type === 'touchstart') {
                    globalLastTouchTime = now;
                }
                
                // Prevent default để tránh double fire sự kiện click của trình duyệt
                if (e.cancelable && e.type !== 'mousedown') e.preventDefault();

                const timeDiff = now - lastTapTime;
                
                // Logic Double Tap (50ms < diff < 300ms)
                if (timeDiff < 300 && timeDiff > 50) {
                    // --- DOUBLE TAP: Toggle Slider ---
                    if (clickTimer) clearTimeout(clickTimer);
                    
                    if (sepiaPanel) {
                        sepiaPanel.classList.toggle("hidden");
                        logger.info("Gesture", "Double tap detected -> Toggle Sepia Slider");
                    }
                    
                    lastTapTime = 0; // Reset
                } else {
                    // --- SINGLE TAP: Toggle Theme (Delayed) ---
                    lastTapTime = now;
                    
                    // Delay để chờ xem có tap lần 2 không
                    clickTimer = setTimeout(() => {
                        const newTheme = currentTheme === "light" ? "dark" : "light";
                        applyTheme(newTheme);
                        // Ẩn slider nếu đang mở khi đổi theme (optional UX choice)
                        if (sepiaPanel && !sepiaPanel.classList.contains("hidden")) {
                            sepiaPanel.classList.add("hidden");
                        }
                    }, 300); // 300ms delay
                }
            };

            // Gắn sự kiện giống FilterGestures
            btn.addEventListener("mousedown", handleAction);
            btn.addEventListener("touchstart", handleAction, { passive: false });
            
            // Disable default click
            btn.addEventListener("click", (e) => e.preventDefault());
        }

        // --- Slider Event ---
        if (sepiaSlider) {
            sepiaSlider.addEventListener("input", (e) => {
                applySepia(e.target.value);
            });
            
            // Ẩn slider khi click ra ngoài (UX Improvement)
            document.addEventListener("click", (e) => {
                if (!sepiaPanel.classList.contains("hidden") && 
                    !sepiaPanel.contains(e.target) && 
                    !btn.contains(e.target)) {
                    sepiaPanel.classList.add("hidden");
                }
            });
        }
    }
};