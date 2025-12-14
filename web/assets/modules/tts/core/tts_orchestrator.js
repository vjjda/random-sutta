// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSWebSpeechEngine } from '../engines/tts_web_speech_engine.js';
import { TTSGoogleCloudEngine } from '../engines/tts_gcloud_engine.js'; // [NEW]
import { TTSStateStore } from './tts_state_store.js';
import { TTSPlayer } from './tts_player.js';
import { TTSHighlighter } from './tts_highlighter.js';
import { TTSMarkerManager } from './tts_marker_manager.js'; // [NEW] Import needed
import { TTSSessionManager } from './tts_session_manager.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    engine: null, // Current active engine
    engines: {},  // Map of available engines
    ui: null, 
    onAutoNextRequest: null,

    init() {
        TTSStateStore.init();

        // 1. Init Engines
        this.engines = {
            'wsa': new TTSWebSpeechEngine(),
            'gcloud': new TTSGoogleCloudEngine()
        };

        // 2. Select Engine based on stored state
        const savedEngine = TTSStateStore.activeEngine;
        this.engine = this.engines[savedEngine] || this.engines['wsa'];
        
        // Bind Cache Event
        if (this.engines['gcloud']) {
            this.engines['gcloud'].onAudioCached = (text) => {
                 TTSMarkerManager.markAsCached(text);
                 // Future logic can go here if needed
            };
            // [NEW] Bind Voices Changed Event
            this.engines['gcloud'].onVoicesChanged = (voices, currentVoice) => {
                if (this.ui) {
                    this.ui.populateVoices(voices, currentVoice);
                    this.refreshOfflineVoicesStatus(); // Re-apply styles
                }
            };
        }
        
        logger.info("Init", `Active Engine: ${savedEngine || 'wsa'}`);
        
        // 3. Init Modules
        // Highlighter cần UI (sẽ set sau khi UI init)
        
        // Player cần Engine, Highlighter, UI
        TTSPlayer.init(this.engine, TTSHighlighter, null);
        
        // SessionManager cần Player, Highlighter, UI
        TTSSessionManager.init(TTSPlayer, TTSHighlighter, null);

        // Setup Callback khi Player đọc xong bài
        TTSPlayer.setCallbacks(() => this._handlePlaylistEnd());

        logger.info("Init", "Orchestrator Ready (Refactored)");
    },

    setUI(uiInstance) {
        this.ui = uiInstance;
        
        // Inject UI vào các sub-modules
        TTSHighlighter.setUI(uiInstance);
        TTSPlayer.ui = uiInstance;
        TTSSessionManager.ui = uiInstance;

        // Sync UI state ban đầu
        if (this.ui) {
            this.ui.updateAutoNextState(TTSStateStore.autoNextEnabled);
            this.ui.updatePlaybackModeState(TTSStateStore.playbackMode === 'paragraph');
            
            // Sync Engine UI
            const apiKey = this.engines['gcloud'] ? this.engines['gcloud'].apiKey : "";
            this.ui.updateEngineState(TTSStateStore.activeEngine, apiKey);
            
            // Sync Voice and Pitch
            this.ui.populateVoices(this.engine.getVoices(), this.engine.voice);
            this.ui.updateRateDisplay(this.engine.rate);
        }
    },

    // --- Engine Management ---

    switchEngine(engineId) {
        if (!this.engines[engineId]) {
            logger.warn("SwitchEngine", `Unknown engine: ${engineId}`);
            return;
        }

        if (TTSStateStore.activeEngine === engineId) return;

        logger.info("SwitchEngine", `Switching to ${engineId}...`);

        // 1. Stop current playback
        this.stop();

        // 2. Switch
        this.engine = this.engines[engineId];
        TTSStateStore.setActiveEngine(engineId);

        // 3. Re-bind Player
        TTSPlayer.init(this.engine, TTSHighlighter, this.ui);
        
        // 3.1 Bind Events (Cache updates)
        if (this.engine.onAudioCached === null) {
             this.engine.onAudioCached = (text) => {
                 TTSMarkerManager.markAsCached(text);
             };
        }
        
        // 4. Update UI Voices List (Different engines have different voices)
        if (this.ui) {
            this.ui.populateVoices(this.engine.getVoices(), this.engine.voice);
            this.ui.updateRateDisplay(this.engine.rate);
        }

        // 5. Update Markers (Cache status might change)
        if (this.isSessionActive()) {
            TTSMarkerManager.checkCacheStatus(this.engine);
            this.refreshOfflineVoicesStatus(); // Re-apply styles
        }
    },

    setGCloudApiKey(key) {
        if (this.engines['gcloud']) {
            this.engines['gcloud'].setApiKey(key);
        }
    },

    refreshVoices() {
        if (this.engine.refreshVoices) {
            this.engine.refreshVoices(true); // Force refresh
        }
    },

    setVoice(voiceURI) {
        if (this.engine && this.engine.setVoice) {
            this.engine.setVoice(voiceURI);
            
            // Trigger status updates
            if (this.isSessionActive()) {
                TTSMarkerManager.checkCacheStatus(this.engine);
            }
        }
    },

    setCallbacks(callbacks) {
        if (callbacks && typeof callbacks.onAutoNext === 'function') {
            this.onAutoNextRequest = callbacks.onAutoNext;
        }
    },

    // --- Voice Status Sync ---
    
    async refreshOfflineVoicesStatus() {
        if (!this.engine || typeof this.engine.getOfflineVoices !== 'function') return;
        if (!this.isSessionActive()) return;

        const texts = TTSStateStore.playlist.map(item => item.text);
        try {
            const offlineVoiceURIs = await this.engine.getOfflineVoices(texts);
            if (this.ui) {
                this.ui.updateVoiceOfflineMarkers(offlineVoiceURIs);
            }
        } catch (e) {
            logger.warn("OfflineStatus", "Failed to check offline voices", e);
        }
    },

    // --- Public Facade (Clean API) ---

    startSession() { 
        TTSSessionManager.start(); 
        this.refreshOfflineVoicesStatus(); // [NEW] Check all voices
    },
    endSession() { TTSSessionManager.end(); },
    refreshSession(autoPlay) { 
        TTSSessionManager.refresh(autoPlay); 
        this.refreshOfflineVoicesStatus();
    },
    
    isSessionActive() { return TTSSessionManager.isActive(); },
    isPlaying() { return TTSStateStore.isPlaying; },

    // --- Controls ---

    togglePlay() {
        if (!TTSSessionManager.isActive()) {
            this.startSession();
        }
        // Defensive: Check playlist empty
        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
            if (TTSStateStore.playlist.length === 0) return;
        }

        if (TTSStateStore.isPlaying) TTSPlayer.pause();
        else TTSPlayer.play();
    },

    play() { TTSPlayer.play(); },
    pause() { TTSPlayer.pause(); },
    stop() { TTSPlayer.stop(); },
    next() { TTSPlayer.next(); },
    prev() { TTSPlayer.prev(); },

    jumpToID(id) {
        if (!TTSSessionManager.isActive()) return;

        if (TTSStateStore.playlist.length === 0) {
            TTSSessionManager.refresh();
        }

        const index = TTSStateStore.playlist.findIndex(item => item.id === id);
        if (index !== -1) {
            TTSPlayer.jumpTo(index);
        }
    },

    setAutoNext(enabled) {
        TTSStateStore.setAutoNext(enabled);
    },

    setPlaybackMode(mode) {
        if (TTSStateStore.playbackMode === mode) return;
        
        // 1. Save state
        TTSStateStore.setPlaybackMode(mode);

        if (!this.isSessionActive()) return;

        // 2. Capture current position (best effort)
        const currentItem = TTSStateStore.getCurrentItem();
        let targetId = currentItem ? currentItem.id : null;

        // 3. Refresh playlist (stops player)
        TTSSessionManager.refresh(false);

        // 4. Try to jump back to context
        if (targetId) {
            // If switching Seg -> Para: Para ID is the first seg ID.
            // If switching Para -> Seg: targetId is the Para ID (first seg ID).
            // So logic works both ways if we just look for ID existence.
            
            // However, if we were in middle of Para (e.g. seg 3), and switch to Para Mode.
            // We need to find the Para containing seg 3.
            // But standard JumpToID searches by ID.
            // Para ID = First Seg ID.
            // If we are at Seg 3, Para ID != Seg 3 ID.
            // We need a smarter lookup?
            
            // Simple approach first: Just try jump.
            this.jumpToID(targetId);
            
            // Smart approach (if simple fails):
            // If we are in Para mode now, and simple jump failed (because targetId was a sub-segment),
            // we should find which block contains that segment.
            if (TTSStateStore.playbackMode === 'paragraph') {
                const foundIndex = TTSStateStore.playlist.findIndex(block => {
                    return block.segments && block.segments.some(s => s.id === targetId);
                });
                if (foundIndex !== -1) {
                    TTSPlayer.jumpTo(foundIndex);
                }
            }
        }
    },

    // --- Business Logic: Playlist End Strategy ---

    async _handlePlaylistEnd() {
        // Orchestrator quyết định làm gì khi hết bài (đây là Business Logic, không phải Player Logic)
        if (TTSStateStore.autoNextEnabled && this.onAutoNextRequest) {
            logger.info("AutoNext", "Playlist ended. Requesting next...");
            if (this.ui) this.ui.updateStatus("Loading next...");

            try {
                // Gọi callback ra ngoài (SuttaController sẽ load bài mới)
                // SuttaController load xong sẽ gọi lại refreshSession(true)
                await this.onAutoNextRequest();
                
                // Stop tạm thời để an toàn, chờ lệnh refresh từ Controller
                TTSPlayer.stop(); 
            } catch (e) {
                logger.error("AutoNext", "Failed", e);
                TTSPlayer.stop();
            }
        } else {
            TTSPlayer.stop();
        }
    }
};