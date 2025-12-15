// Path: web/assets/modules/tts/ui/tts_ui_layout.js
export const TTSUILayout = {
    getHTML() {
        // ... (Giữ nguyên phần đầu: logic lấy biến settings) ...
        const savedAutoNext = localStorage.getItem("tts_auto_next");
        const isAutoNext = savedAutoNext === null ? true : (savedAutoNext === "true");
        const savedMode = localStorage.getItem("tts_playback_mode");
        const isParagraph = savedMode ? (savedMode === "paragraph") : true; 
        const savedEngine = localStorage.getItem("tts_active_engine");
        const isGCloud = (savedEngine === "gcloud");

        return `
            <button id="magic-tts-trigger" title="Enable TTS"></button>
            <div id="tts-player">
                
                <div class="tts-header-container">
                    <div class="tts-info" id="tts-info-text">Ready</div>
                </div>

                <div class="tts-controls-row">
                    <button id="tts-settings-toggle" class="tts-btn" title="Voice Settings">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
        
                    <button id="tts-prev" class="tts-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                    </button>
                    
                    <button id="tts-play" class="tts-btn tts-btn-main">
                        <svg class="icon-play" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <svg class="icon-pause hidden" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
                    </button>
            
                    <button id="tts-next" class="tts-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                    </button>
                    
                    <button id="tts-close" class="tts-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div id="tts-settings-panel" class="hidden">
                    
                    <!-- MAIN SETTINGS VIEW -->
                    <div id="tts-settings-main">
                        <!-- Top Right Key Toggle -->
                        <div style="position: absolute; top: 12px; right: 12px; z-index: 5;">
                            <button id="tts-keys-toggle" class="tts-icon-btn" title="Manage API Keys" style="opacity: 0.7;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                                </svg>
                            </button>
                        </div>

                        <div class="tts-setting-row">
                            <label for="tts-engine-select">Provider</label>
                            <select id="tts-engine-select" name="tts_provider" autocomplete="off">
                                <option value="wsa" ${!isGCloud ? 'selected' : ''}>Browser Default</option>
                                <option value="gcloud" ${isGCloud ? 'selected' : ''}>Google Cloud</option>
                            </select>
                        </div>

                        <!-- Speed -->
                        <div class="tts-setting-row">
                            <label for="tts-rate-range">Speed: <span id="tts-rate-val">1.0</span>x</label>
                            <input type="range" id="tts-rate-range" name="tts_speed" min="0.5" max="2.5" step="0.05" value="1.0" autocomplete="off">
                        </div>
                    
                        <div class="tts-setting-row">
                             <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label for="tts-voice-select" style="margin-bottom: 0;">Voice</label>
                                    <button id="tts-refresh-voices" class="tts-icon-btn" title="Refresh List">
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                    </button>
                                </div>
                            </div>
                            <select id="tts-voice-select" name="tts_voice" autocomplete="off"></select>
                        </div>
                        
                         <div class="tts-toggle-wrapper">
                            <label for="tts-auto-next" class="tts-toggle-label">Auto-play Next</label>
                            <label class="tts-switch">
                                <input type="checkbox" id="tts-auto-next" name="tts_auto_next" ${isAutoNext ? 'checked' : ''} autocomplete="off">
                                <span class="tts-slider"></span>
                            </label>
                        </div>
    
                        <div class="tts-toggle-wrapper">
                            <label for="tts-mode-toggle" class="tts-toggle-label">Paragraph Mode</label>
                            <label class="tts-switch">
                                 <input type="checkbox" id="tts-mode-toggle" name="tts_mode" ${isParagraph ? 'checked' : ''} autocomplete="off">
                                <span class="tts-slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- KEYS MANAGEMENT VIEW -->
                    <div id="tts-settings-keys" class="hidden" style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 10px; margin-bottom: 5px;">
                            <span style="font-weight: 700; color: var(--text-main);">API Keys</span>
                            <button id="tts-keys-back" class="tts-icon-btn" title="Back">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                            </button>
                        </div>

                        <!-- GCloud Key (Always visible in this view) -->
                        <div class="tts-setting-row" id="tts-apikey-row">
                            <form onsubmit="return false;" style="display: contents;">
                                <input type="text" name="username" autocomplete="username" style="display:none;">
                                <label for="tts-apikey-input">Google Cloud API Key</label>
                                <input type="password" id="tts-apikey-input" name="api_key" placeholder="Enter Key..." autocomplete="new-password" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-main);">
                            </form>
                            <p style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">Required for high-quality neural voices.</p>
                        </div>
                        
                        <!-- Future Azure/OpenAI keys go here -->
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