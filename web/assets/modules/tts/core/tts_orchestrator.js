// Path: web/assets/modules/tts/core/tts_orchestrator.js
import { TTSStateStore } from './tts_state_store.js';
import { TTSPlayer } from './tts_player.js';
import { TTSHighlighter } from './tts_highlighter.js';
import { TTSSessionManager } from './tts_session_manager.js';
import { TTSMarkerManager } from './tts_marker_manager.js';
import { getLogger } from '../utils/logger.js';

// Sub-modules
import { TTSEngineRegistry } from './orchestrator/engine_registry.js';
import { TTSPlaybackController } from './orchestrator/playback_controller.js';
import { TTSUISynchronizer } from './orchestrator/ui_synchronizer.js';

const logger = getLogger("TTS_Orchestrator");

export const TTSOrchestrator = {
    registry: null,
    playback: null,
    uiSync: null,

    init() {
        TTSStateStore.init();

        // 1. Initialize Sub-modules
        this.registry = new TTSEngineRegistry();
        this.registry.init();

        this.uiSync = new TTSUISynchronizer(this.registry);
        this.playback = new TTSPlaybackController(this.uiSync);

        // 2. Wire up Events
        
        // When Engine changes -> Rebind Player & Sync UI
        this.registry.onEngineChanged = (newEngine) => {
            this._bindPlayer(newEngine);
            this.uiSync.onEngineChanged(newEngine);
            
            // Check cache status for markers
            if (TTSSessionManager.isActive()) {
                TTSMarkerManager.checkCacheStatus(newEngine);
            }
        };

        // When Audio Cached (GCloud) -> Update Marker & UI
        this.registry.onAudioCached = (text) => {
            TTSMarkerManager.markAsCached(text);
            this.uiSync.debouncedRefreshOfflineStatus();
        };

        // When GCloud Voices Loaded -> Sync UI
        // (Access gcloud engine directly for binding specific event)
        const gcloud = this.registry.getEngine('gcloud');
        if (gcloud) {
            gcloud.onVoicesChanged = (voices, current) => {
                if (this.uiSync.ui) { // Check if UI is ready
                    this.uiSync.ui.populateVoices(voices, current);
                    this.uiSync.refreshOfflineVoicesStatus();
                }
            };
        }

        // 3. Initial Binding
        this._bindPlayer(this.registry.getActiveEngine());
        
        // 4. Setup Session Manager
        TTSSessionManager.init(TTSPlayer, TTSHighlighter, null); // UI injected later

        // 5. Setup Player Callback
        TTSPlayer.setCallbacks(() => this.playback.handlePlaylistEnd());

        logger.info("Init", "Orchestrator Initialized (Modular)");
    },

    // Helper to connect Player with Engine
    _bindPlayer(engine) {
        // Stop old playback first
        TTSPlayer.stop(); 
        // Re-init with new engine, keeping existing Highlighter/UI refs
        TTSPlayer.init(engine, TTSHighlighter, this.uiSync.ui);
        
        // Re-bind cache event on the engine level if needed 
        // (Note: Registry handles the global bubble up, but Player uses engine directly)
        if (engine.onAudioCached === null) {
             engine.onAudioCached = (text) => {
                 TTSMarkerManager.markAsCached(text);
             };
        }
    },

    setUI(uiInstance) {
        // Inject UI into subsystems
        TTSHighlighter.setUI(uiInstance);
        TTSPlayer.ui = uiInstance;
        TTSSessionManager.ui = uiInstance;
        
        // Inject into Synchronizer
        this.uiSync.setUI(uiInstance);
    },

    setCallbacks(callbacks) {
        this.playback.setCallbacks(callbacks);
    },

    // --- Public API Delegation ---

    // Playback
    togglePlay() { this.playback.togglePlay(); },
    play() { this.playback.play(); },
    pause() { this.playback.pause(); },
    stop() { this.playback.stop(); },
    next() { this.playback.next(); },
    prev() { this.playback.prev(); },
    jumpToID(id) { this.playback.jumpToID(id); },
    
    // State & Config
    setAutoNext(e) { TTSStateStore.setAutoNext(e); },
    setPlaybackMode(m) { this.playback.setPlaybackMode(m); },
    
    // Engine & Voice
    switchEngine(id) { 
        if (this.registry.switchEngine(id)) {
            // Update UI visibility for API Key (handled in registry event? No, explicit here for safety)
            this.uiSync.ui.updateEngineState(id, null);
        }
    },
    setGCloudApiKey(k) { this.registry.setGCloudApiKey(k); },
    refreshVoices() { this.registry.refreshVoices(); },
    setVoice(uri) { 
        this.registry.setVoice(uri);
        // Trigger status updates if session active
        if (this.isSessionActive()) {
            TTSMarkerManager.checkCacheStatus(this.registry.getActiveEngine());
        }
    },
    
    // Session
    startSession() { 
        TTSSessionManager.start(); 
        this.uiSync.refreshOfflineVoicesStatus();
    },
    endSession() { TTSSessionManager.end(); },
    refreshSession(autoPlay) { 
        TTSSessionManager.refresh(autoPlay);
        this.uiSync.refreshOfflineVoicesStatus();
    },
    
    isSessionActive() { return TTSSessionManager.isActive(); },
    isPlaying() { return TTSStateStore.isPlaying; },
    
    // Specific Exposed Methods
    refreshOfflineVoicesStatus() { this.uiSync.refreshOfflineVoicesStatus(); },
    
    // Accessors
    get engine() { return this.registry.getActiveEngine(); } // Backward compatibility if needed
};