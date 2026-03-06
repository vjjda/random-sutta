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
    // Cache for quick switching
    voicesByRegion: new Map(),

    render(regionSelect, voiceSelect, voices, currentVoice, isGCloud, hasKey) {
        regionSelect.innerHTML = "";
        voiceSelect.innerHTML = "";
        regionSelect.disabled = false;
        voiceSelect.disabled = false;

        // 1. Error/Loading States
        if (isGCloud && !hasKey) {
            this._addOption(voiceSelect, "", "✨ Enter API Key to load voices...");
            voiceSelect.disabled = true;
            regionSelect.disabled = true;
            return;
        }
        if (isGCloud && hasKey && (!voices || voices.length === 0)) {
            this._addOption(voiceSelect, "", "⏳ Loading voices or Invalid Key...");
            voiceSelect.disabled = true;
            regionSelect.disabled = true;
            return;
        }
        if (!voices || voices.length === 0) {
            this._addOption(voiceSelect, "", "No voices available");
            voiceSelect.disabled = true;
            regionSelect.disabled = true;
            return;
        }

        // 2. Group Voices by Region
        this.voicesByRegion.clear();
        voices.forEach(v => {
            const lang = v.lang || "Unknown";
            if (!this.voicesByRegion.has(lang)) {
                this.voicesByRegion.set(lang, []);
            }
            this.voicesByRegion.get(lang).push(v);
        });

        // 3. Populate Region Select
        const regions = Array.from(this.voicesByRegion.keys()).sort();
        
        let selectedRegion = localStorage.getItem("tts_last_region");
        
        // Priority 1: Current Voice's region
        if (currentVoice && currentVoice.lang) {
            selectedRegion = currentVoice.lang;
        }
        
        // Priority 2: Fallback defaults
        if (!selectedRegion || !this.voicesByRegion.has(selectedRegion)) {
            if (this.voicesByRegion.has("en-US")) selectedRegion = "en-US";
            else if (this.voicesByRegion.has("en-GB")) selectedRegion = "en-GB";
            else selectedRegion = regions[0];
        }

        regions.forEach(r => {
            const flag = getFlagEmoji(r);
            const label = `${flag} ${r}`; // e.g. "🇺🇸 en-US"
            this._addOption(regionSelect, r, label);
        });
        
        regionSelect.value = selectedRegion;

        // 4. Render Voices for Initial Region
        this.renderVoicesForSelectedRegion(regionSelect, voiceSelect, currentVoice);
    },

    /**
     * Public method to update voice list when region changes
     */
    renderVoicesForSelectedRegion(regionSelect, voiceSelect, currentVoice = null) {
        const region = regionSelect.value;
        if (!region || !this.voicesByRegion.has(region)) return;

        voiceSelect.innerHTML = "";
        const voices = this.voicesByRegion.get(region);

        // --- Same Formatting Logic as Before ---
        const recommendedConfig = AppConfig.TTS?.RECOMMENDED_VOICES || [];
        const recommendedMap = new Map(recommendedConfig.map(i => [i.voiceURI, i]));
        
        const recommendedList = [];
        const otherList = [];

        voices.forEach(v => {
            const recEntry = recommendedMap.get(v.voiceURI);
            const prettyName = formatVoiceName(v.name);
            // Flag is already in region select, maybe redundant here? 
            // But let's keep clean name.
            
            let typeIcon = "";
            if (v.localService === false) typeIcon = "☁️";

            let finalName = prettyName; // Simplify name inside voice box
            if (typeIcon) finalName += ` ${typeIcon}`;

            if (recEntry) {
                let recName = recEntry.name;
                recommendedList.push({
                    ...v,
                    displayName: recName || ("★ " + finalName)
                });
            } else {
                otherList.push({ ...v, displayName: finalName });
            }
        });

        // Sort Recommended
        if (recommendedList.length > 0) {
            recommendedList.sort((a, b) => {
                const idxA = recommendedConfig.findIndex(c => c.voiceURI === a.voiceURI);
                const idxB = recommendedConfig.findIndex(c => c.voiceURI === b.voiceURI);
                return idxA - idxB;
            });
            recommendedList.forEach(v => this._addOption(voiceSelect, v.voiceURI, "\u00A0" + v.displayName, v.displayName));
            
            if (otherList.length > 0) {
                const sep = document.createElement("option");
                sep.disabled = true;
                sep.textContent = "──────────";
                voiceSelect.appendChild(sep);
            }
        }

        // Render Others
        otherList.forEach(v => this._addOption(voiceSelect, v.voiceURI, "\u00A0" + v.displayName, v.displayName));

        // Restore Selection if valid
        if (currentVoice && currentVoice.lang === region) {
            voiceSelect.value = currentVoice.voiceURI;
        } else {
            // Select first available if logic switched region
            if (voiceSelect.options.length > 0) {
                voiceSelect.selectedIndex = 0;
                // Optional: trigger change? No, let user decide.
            }
        }
    },

    updateOfflineMarkers(selectEl, offlineVoiceURIs) {
        const offlineSet = new Set(offlineVoiceURIs);
        const options = selectEl.options;
        
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const originalName = opt.dataset.displayName;
            if (originalName) {
                const prefix = offlineSet.has(opt.value) ? "• " : "\u00A0";
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