// Path: web/assets/modules/tts/ui/renderers/settings_renderer.js
export const TTSSettingsRenderer = {
    updateEngineState(elements, engineId, apiKey) {
        if (elements.engineSelect) {
            elements.engineSelect.value = engineId;
        }
        if (elements.apiKeyRow) {
            if (engineId === 'gcloud') {
                elements.apiKeyRow.classList.remove('hidden');
                // Auto focus logic
                if (!apiKey && elements.apiKeyInput) {
                    setTimeout(() => elements.apiKeyInput.focus(), 100);
                }
            } else {
                elements.apiKeyRow.classList.add('hidden');
            }
        }
        if (elements.apiKeyInput) {
            if (apiKey !== null && apiKey !== undefined) {
                elements.apiKeyInput.value = apiKey;
            }
        }
    },

    updateRate(elements, value) {
        if (elements.rateRange) elements.rateRange.value = value;
        if (elements.rateVal) elements.rateVal.textContent = value;
    },

    updateToggles(elements, autoNext, paragraphMode) {
        // [FIX] Chỉ update nếu giá trị khác null/undefined
        // Tránh việc update cái này lại làm reset cái kia về false
        if (elements.autoNextCheckbox && autoNext !== null && autoNext !== undefined) {
            elements.autoNextCheckbox.checked = autoNext;
        }
        
        if (elements.modeCheckbox && paragraphMode !== null && paragraphMode !== undefined) {
            elements.modeCheckbox.checked = paragraphMode;
        }
    },

    togglePanel(elements, forceState) {
        if (!elements.settingsPanel) return;
        if (forceState === false) {
            elements.settingsPanel.classList.add("hidden");
        } else {
            elements.settingsPanel.classList.toggle("hidden");
        }
    }
};