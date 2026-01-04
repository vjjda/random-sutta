// Path: web/assets/modules/tts/ui/renderers/settings_renderer.js
export const TTSSettingsRenderer = {
    updateEngineState(elements, engineId, apiKey) {
        if (elements.engineSelect) {
            elements.engineSelect.value = engineId;
        }
        // [UPDATED] Removed apiKeyRow toggling logic as it's now in dedicated view
        
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
        
        // Helper để đóng
        const close = () => {
            elements.settingsPanel.classList.add("hidden");
            elements.player?.classList.remove("settings-active");
        };

        // Helper để mở
        const open = () => {
            elements.settingsPanel.classList.remove("hidden");
            elements.player?.classList.add("settings-active");
        };

        if (forceState === false) {
            close();
        } else if (forceState === true) {
            open();
        } else {
            // Toggle
            if (elements.settingsPanel.classList.contains("hidden")) {
                open();
            } else {
                close();
            }
        }
    }
};