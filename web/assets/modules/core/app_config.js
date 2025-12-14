// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // ... (Giữ nguyên các config cũ)
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    TTS: {
        SCROLL_OFFSET_TOP: '15vh',
        BOTTOM_PADDING: '300px', 
        
        DEFAULT_VOICE: {
            voiceURI: "en-US-Chirp3-HD-Algenib"
        },

        // [NEW] Cấu hình Cờ Quốc Gia
        VOICE_FLAGS: {
            "en-US": "🇺🇸",
            "en-GB": "🇬🇧",
            "de-DE": "🇩🇪",
            "ja-JP": "🇯🇵",
            "zh-CN": "🇨🇳",
            "zh-TW": "🇹🇼",
            "vi-VN": "🇻🇳"
        },

        // Danh sách Recommended (Giờ đây không cần hardcode cờ vào name nữa)
        RECOMMENDED_VOICES: [
            { 
                voiceURI: "en-US-Chirp3-HD-Algenib", 
                name: "Chirp 3 Algenib (Deep)" 
            },
            { 
                voiceURI: "en-US-Chirp3-HD-Puck", 
                name: "Chirp 3 Puck (Clear)" 
            },
            { 
                voiceURI: "en-GB-Chirp3-HD-Orion", 
                name: "Chirp 3 Orion (British)" 
            },
            { 
                voiceURI: "en-US-Neural2-D",
                name: "Neural 2 D (Male)"
            },
            { 
                voiceURI: "en-en-US-Polyglot-1",
                name: "Polyglot (Male)"
            }
        ],
        
        BUFFER_AHEAD: 7,
        PARAGRAPH_SPLIT_THRESHOLD: 300
    },

    POPUP_LAYOUT: {
        COMMENT_HEIGHT_VH: 40, 
        QUICKLOOK_TOP_OFFSET_PX: 0 
    },

    SEPIA: {
        MAX_CSS_LIGHT: 50,
        MAX_CSS_DARK: 100,
        HUE_COEFF: -0.25, 
        SATURATE: 1.0,
        STORAGE_KEY_PREFIX: "sutta_sepia_"
    },

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