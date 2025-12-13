// Path: web/assets/modules/tts/ui/tts_ui_layout.js
export const TTSUILayout = {
    getHTML() {
        return `
            <div class="tts-setting-row">
                        <label>Voice</label>
                        <select id="tts-voice-select"></select>
                    </div>
                    
                    <div class="tts-toggle-wrapper">
                        <label for="tts-auto-next" class="tts-toggle-label">Auto-play Next</label>
                        <label class="tts-switch">
                            <input type="checkbox" id="tts-auto-next">
                            <span class="tts-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    },
    inject() {
        if (document.getElementById("magic-tts-trigger")) return;
        document.body.insertAdjacentHTML('beforeend', this.getHTML());
    }
};