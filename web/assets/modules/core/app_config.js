// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // Random & Buffer Strategy
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    
    // UI/UX
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    // [UPDATED] TTS Configuration
    TTS: {
        // Khoảng cách từ mép trên màn hình đến đoạn văn đang đọc (Highlight)
        // '30vh' = 30% chiều cao màn hình. '100px' = 100 pixels.
        SCROLL_OFFSET_TOP: '30vh',

        // Khoảng trống đệm dưới cùng trang web để Player không che mất dòng cuối
        BOTTOM_PADDING: '120px', 
    },

    // Popup Layout Configuration
    POPUP_LAYOUT: {
        COMMENT_HEIGHT_VH: 40, 
        QUICKLOOK_TOP_OFFSET_PX: 0 
    },

    // Sepia / Night Shift Configuration
    SEPIA: {
        MAX_CSS_LIGHT: 50,
        MAX_CSS_DARK: 100,
        HUE_COEFF: -0.25, 
        SATURATE: 1.0,
        STORAGE_KEY_PREFIX: "sutta_sepia_"
    },

    // Persistent Settings
    PERSISTENT_SETTINGS: [
        "sutta_theme",
        "sutta_font_scale",
        "sutta_sepia_light",
        "sutta_sepia_dark",
        "tts_rate",
        "tts_voice_uri",
        "tts_auto_next"
    ]
};