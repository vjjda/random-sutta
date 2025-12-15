// Path: web/assets/modules/tts/core/tts_marker_manager.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("TTS_MarkerManager");

export const TTSMarkerManager = {
    // Keep track of injected markers to clean up easily
    markers: [],
    playlist: [], // [NEW] Keep ref to playlist

    /**
     * Injects markers into the DOM based on the current playlist.
     * [UPDATED] Ensures only one marker per physical element, even if split into chunks.
     * @param {Array} playlist - The current TTS playlist (segments or blocks)
     */
    inject(playlist) {
        this.remove(); // Clear existing first
        this.playlist = playlist; // Store for cache checking

        logger.info("Inject", `Injecting markers for ${playlist.length} items...`);

        // Track processed elements to avoid duplicate markers
        const processedElements = new Set();

        playlist.forEach((item) => {
            if (!item.element || processedElements.has(item.element)) return;

            // Mark element as processed
            processedElements.add(item.element);

            // Create Marker
            const marker = document.createElement("button");
            marker.className = "tts-marker";
            marker.setAttribute("aria-label", "Play from here");
            // Use the first chunk's ID as the anchor
            marker.setAttribute("data-tts-id", item.id); 
            // Link marker back to element for reverse lookup if needed
            // marker.dataset.elementId = item.element.id; 
            
            // Inject: Prepend to the element
            if (item.element.firstChild) {
                item.element.insertBefore(marker, item.element.firstChild);
            } else {
                item.element.appendChild(marker);
            }

            this.markers.push(marker);
        });
    },

    /**
     * Removes all injected markers from the DOM.
     */
    remove() {
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.playlist = [];
        logger.info("Remove", "Markers cleared.");
    },

    /**
     * Updates marker state when a text is cached.
     * Re-evaluates the whole group (element) status.
     * @param {string} text - The text that was just cached.
     */
    markAsCached(text) {
        if (!text) return;
        
        // Find the item(s) that match this text
        // (Text *might* be duplicated across different segments, but usually unique enough in context)
        const targetItems = this.playlist.filter(p => p.text === text);
        
        targetItems.forEach(item => {
            this._updateMarkerStatus(item.element);
        });
    },

    /**
     * Updates marker visual state based on cache availability.
     * @param {Object} engine - The active TTS engine instance.
     */
    async checkCacheStatus(engine) {
        if (!engine || typeof engine.isCached !== 'function') return;

        logger.debug("CacheCheck", "Checking cache status for markers...");
        
        // 1. Bulk check status for all items
        // Map: item.id -> boolean (isCached)
        const cacheStatusMap = new Map();
        
        for (const item of this.playlist) {
            try {
                const isCached = await engine.isCached(item.text);
                cacheStatusMap.set(item.id, isCached);
            } catch (e) {
                cacheStatusMap.set(item.id, false);
            }
        }

        // 2. Group by Element and Apply Classes
        const processedElements = new Set();
        this.playlist.forEach(item => {
            if (processedElements.has(item.element)) return;
            processedElements.add(item.element);

            this._applyStatusToElement(item.element, cacheStatusMap);
        });
    },

    /**
     * [HELPER] Calculate status for an element and update its marker
     */
    _updateMarkerStatus(element) {
        // Find all chunks belonging to this element
        const chunks = this.playlist.filter(p => p.element === element);
        if (chunks.length === 0) return;

        // Since this is called from markAsCached (sync/async mix), 
        // we might need to check the engine again or rely on a state store.
        // But for simplicity, we assume if markAsCached is called, THAT specific chunk is cached.
        // To be robust, let's trigger a full re-check for this element if possible, 
        // or just add 'partial' blindly?
        
        // Better: Find the marker and assume partial first, then let the full check resolve it later?
        // OR: Since we don't have the engine here easily, we rely on the caller or just highlight partial.
        
        // For now: Just highlight as partial/cached if we find the marker.
        // To do it properly, we need the Engine. 
        // But markAsCached is often called from an event where Engine is implicitly known.
        
        // Let's use a simple heuristic:
        // If we just cached a chunk, at least it is PARTIAL.
        // We can't know if it's FULL without checking all peers.
        
        const marker = this.markers.find(m => m.getAttribute("data-tts-id") === chunks[0].id);
        if (marker) {
            // Safe bet: Add partial. The full check will upgrade to cached eventually.
            // Or if it was already cached, keep it.
            if (!marker.classList.contains("cached")) {
                marker.classList.add("partial");
            }
        }
    },

    /**
     * [HELPER] Apply Cached/Partial status to an element's marker
     */
    _applyStatusToElement(element, cacheStatusMap) {
        const chunks = this.playlist.filter(p => p.element === element);
        if (chunks.length === 0) return;

        // Determine group status
        const total = chunks.length;
        const cachedCount = chunks.filter(c => cacheStatusMap.get(c.id)).length;

        // Find marker (it's linked to the first chunk's ID)
        const marker = this.markers.find(m => m.getAttribute("data-tts-id") === chunks[0].id);
        if (!marker) return;

        // Reset classes
        marker.classList.remove("cached", "partial");

        if (cachedCount === total && total > 0) {
            marker.classList.add("cached");
        } else if (cachedCount > 0) {
            marker.classList.add("partial");
        }
    }
};