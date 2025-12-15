// Path: web/assets/modules/tts/ui/renderers/voice_list_renderer.js
import { AppConfig } from 'core/app_config.js'; 
import { getFlagEmoji } from 'utils/flag_util.js'; // [NEW]

// Helper: Format Name
function formatVoiceName(rawName) {
    let clean = rawName.replace(/^(en-US-|en-GB-)/, '');
    clean = clean.replace('Neural2', 'Neural 2')
                 .replace('Studio', 'Studio')
                 .replace('Wavenet', 'Wavenet')
                 .replace('Polyglot', 'Polyglot')
                 .replace('Standard', 'Standard');

    if (clean.includes('Chirp')) {
        clean = clean.replace('Chirp3-HD-', 'Chirp 3 ');
        clean = clean.replace('Chirp-HD-', 'Chirp ');
    } 
    clean = clean.replace(/-([A-Z])\s/, ' $1 ');
    clean = clean.replace(/-/g, ' ');
    return clean;
}

export const TTSVoiceListRenderer = {
    render(selectEl, voices, currentVoice, isGCloud, hasKey) {
        selectEl.innerHTML = "";
        selectEl.disabled = false;

        // 1. Error/Loading States
        if (isGCloud && !hasKey) {
            this._addOption(selectEl, "", "✨ Enter API Key to load voices...");
            selectEl.disabled = true;
            return;
        }
        if (isGCloud && hasKey && (!voices || voices.length === 0)) {
            this._addOption(selectEl, "", "⏳ Loading voices or Invalid Key...");
            selectEl.disabled = true;
            return;
        }
        if (!voices || voices.length === 0) {
            this._addOption(selectEl, "", "No voices available");
            selectEl.disabled = true;
            return;
        }

        // 2. Prepare Lists
        const recommendedConfig = AppConfig.TTS?.RECOMMENDED_VOICES || [];
        const recommendedMap = new Map(recommendedConfig.map(i => [i.voiceURI, i]));
        
        const recommendedList = [];
        const otherList = [];

        voices.forEach(v => {
            const recEntry = recommendedMap.get(v.voiceURI);
            const prettyName = formatVoiceName(v.name);
            const flag = getFlagEmoji(v.lang); // [UPDATED] Auto generate flag
            
            // [NEW] Service Type Icon (Local vs Network)
            // localService is explicitly true for offline voices. 
            // Some browsers/OS don't report it correctly, but when they do, it's useful.
            let typeIcon = "";
            if (v.localService === false) typeIcon = "☁️";

            // Format chung: "🇺🇸 Tên Giọng ☁️"
            let finalName = flag ? `${flag} ${prettyName}` : prettyName;
            if (typeIcon) finalName += ` ${typeIcon}`;

            if (recEntry) {
                // Với Recommended, ưu tiên tên config, nhưng nếu không có cờ thì tự thêm
                let recName = recEntry.name;
                // Kiểm tra sơ bộ xem trong tên config đã có emoji chưa (đơn giản)
                // Nếu chưa có (thường là text thuần), thêm cờ vào
                if (!/\p{Emoji}/u.test(recName) && flag) {
                     recName = `${flag} ${recName}`;
                }

                recommendedList.push({
                    ...v,
                    displayName: recName || ("★ " + finalName)
                });
            } else {
                otherList.push({ ...v, displayName: finalName });
            }
        });

        // 3. Render Recommended
        if (recommendedList.length > 0) {
            recommendedList.sort((a, b) => {
                const idxA = recommendedConfig.findIndex(c => c.voiceURI === a.voiceURI);
                const idxB = recommendedConfig.findIndex(c => c.voiceURI === b.voiceURI);
                return idxA - idxB;
            });
            recommendedList.forEach(v => this._addOption(selectEl, v.voiceURI, "\u00A0\u00A0\u00A0" + v.displayName, v.displayName));
            
            if (otherList.length > 0) {
                const sep = document.createElement("option");
                sep.disabled = true;
                sep.textContent = "──────────";
                selectEl.appendChild(sep);
            }
        }

        // 4. Render Others
        otherList.forEach(v => this._addOption(selectEl, v.voiceURI, "\u00A0\u00A0\u00A0" + v.displayName, v.displayName));

        if (currentVoice) selectEl.value = currentVoice.voiceURI;
    },

    updateOfflineMarkers(selectEl, offlineVoiceURIs) {
        const offlineSet = new Set(offlineVoiceURIs);
        const options = selectEl.options;
        
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const originalName = opt.dataset.displayName;
            if (originalName) {
                const prefix = offlineSet.has(opt.value) ? "• " : "\u00A0\u00A0\u00A0";
                opt.textContent = prefix + originalName;
            }
        }
    },

    _addOption(parent, value, text, datasetName = null) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        if (datasetName) option.dataset.displayName = datasetName;
        parent.appendChild(option);
    }
};