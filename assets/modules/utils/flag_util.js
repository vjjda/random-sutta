// Path: web/assets/modules/utils/flag_util.js

/**
 * Converts a region code (e.g., 'US', 'VN') or language code (e.g., 'en-US') to a Flag Emoji.
 * @param {string} langCode - The ISO language code (e.g., 'en-US', 'fr-FR', 'ja-JP', 'vi').
 * @returns {string} The flag emoji (e.g., 🇺🇸) or empty string if invalid.
 */
export function getFlagEmoji(langCode) {
    if (!langCode) return "";
    
    // 1. Extract Region Code (e.g., 'US' from 'en-US')
    let region = "";
    if (langCode.includes('-')) {
        region = langCode.split('-').pop().toUpperCase();
    } else if (langCode.length === 2) {
        // If input is just 'US' or 'VN'
        region = langCode.toUpperCase();
    } else {
        // Fallback for codes without region like 'en', 'es' -> No accurate flag, maybe return nothing or specific mapping
        return "";
    }

    // 2. Convert to Regional Indicator Symbols
    // A starts at 0x1F1E6. ASCII 'A' is 65.
    // Offset = 0x1F1E6 - 65 = 127397
    const OFFSET = 127397;
    
    try {
        if (region.length !== 2) return "";
        
        const codePoints = [...region].map(char => char.codePointAt(0) + OFFSET);
        return String.fromCodePoint(...codePoints);
    } catch (e) {
        return "";
    }
}