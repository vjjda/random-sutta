// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // Random & Buffer Strategy
    BUFFER_SIZE: 3, 
    
    // Performance & Preloading
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    
    // UI/UX
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    // [NEW] Sepia Configuration
    SEPIA: {
        // Giá trị CSS Filter tối đa (trên thang 100%) khi thanh trượt ở mức max
        MAX_CSS_LIGHT: 35, // Light Mode: Giới hạn 35% để tránh quá vàng
        MAX_CSS_DARK: 60,  // Dark Mode: Cho phép tới 60% để lọc ánh sáng xanh mạnh hơn
        
        STORAGE_KEY_PREFIX: "sutta_sepia_" // Prefix lưu vào localStorage
    }
};