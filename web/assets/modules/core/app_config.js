// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // Random & Buffer Strategy
    BUFFER_SIZE: 3, 
    
    // Performance & Preloading
    INITIAL_PRELOAD_DELAY: 3000, // ms to wait before starting heavy background tasks
    IDLE_CALLBACK_TIMEOUT: 2000, // ms fallback for requestIdleCallback
    
    // UI/UX
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000, // [NEW] Thời gian tự động đóng Magic Nav khi rời chuột (ms)
};